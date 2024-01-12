require('dotenv').config()
const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const session = require("express-session");
const bcrypt = require('bcrypt')
const { join } = require('node:path');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const {isLogin} = require('./middleware')
const powerService = require('./services/power')
const { db } = require('./db')
const notification = require('./notification');
const { firestore } = require('./firebase');

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});

const sessionMiddleware = session({
  secret: "inirahasia",
  resave: true,
  saveUninitialized: true,
});

app.use(sessionMiddleware);
app.use(express.json())
io.engine.use(sessionMiddleware);

app.use('/images', express.static('images'))

// endpoint
app.get('/', isLogin, (req, res) => {
  res.sendFile(join(__dirname, 'templates/index.html'));
});

app.get('/detail/:id', isLogin,(req, res) => {
  res.sendFile(join(__dirname, 'templates/detail.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, 'templates/login.html'));
});

app.post('/login', async (req, res) => {
  const {username, password} = req.body

  const [users] = await db.query("SELECT * FROM users WHERE username = ?", [username])
  if (users.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'User tidak ditemukan'
    })
  }
  const user = users[0]
  if(!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      success: false,
      message: 'Password salah'
    })
  }

  req.session.user = { username: user.username };

  return res.status(200).json({
    success: true,
    message: 'Login successful'
  })
});

app.post('/data', async (req, res) => {
  const newSampleRequest = {
    watt: 123,
    tegangan: 123,
    arus:123,
    variable: 123,
    frekuensi: 123,
    rel1: 1,
    rel2: 0,
    cb150: 0,
    cb20: 0,
    hvt: 1,
    lvt: 1,
    anomali: 1
  }

  const data = req.body

  console.log({data});
  // update sld
  const sldKey = ['pms1', 'pms2', 'cb150', 'cb20']
  if (Object.keys(data).some(key => sldKey.includes(key))) {
    await db.query(`UPDATE sld SET ? WHERE id = 1`, [data])
    await sendSldStatus()
  }


  // update status
  const messages = {
    hvt: 'Terjadi gangguan sisi HV Trafo - periksa bagian HV pada trafo',
    lvt: 'Terjadi gangguan sisi LV Trafo - periksa bagian LV pada trafo',
    anomali: 'Terjadi anomali - periksa peralatan sistem tenaga'
  }
  const statusKey = ['hvt', 'lvt', 'anomali']
  for (const key of statusKey) {
    if (Object.hasOwn(data, key) && data[key] == '1') {
      const [result] = await db.query("UPDATE status SET is_error='1', is_blink='1' WHERE `key`=? AND last_ack < DATE_SUB(NOW(), INTERVAL 10 MINUTE)", [key])
      if (result.affectedRows > 0) {
        await firestore.collection('status').doc('first').update(data)
        await notification.sendNotification({
          message: messages[key]
        })
      }
      await getStatus()
    }
  }
  

  // update measurement
  const measurementKey = ['watt', 'tegangan', 'arus', 'var', 'frekuensi']
  for (const key of measurementKey) {
    if (Object.hasOwn(data, key)) {
      const value = data[key];
      await db.query("UPDATE measurement SET value=? WHERE `key`=?", [value, key])
      await sendLastMeasurement()
    }
  }

  // update history daya
  if (data.watt) {
    await db.query(`INSERT INTO power_history SET watt=${db.escape(data.watt)}, created_at=NOW()`)
    const result = await getPowerHistory()
    io.sockets.emit('chart', result);
  }

  return res.status(200).json({
    success: true,
    message: 'OK'
  })
  
})

app.post('/users', async (req, res) => {
  const { name, username, password } = req.body
  const { api } = req.headers

  if (api != 'keystone') {
    return res.status(403).json({
      success: false,
      message: 'Api tidak cocok'
    })
  }
  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'masukan name'
    })
  }
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'masukan username'
    })
  }
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'masukan password'
    })
  }

  const encrypted = await bcrypt.hash(password, 10)
  const user = {
    username,
    name,
    password: encrypted
  }
  await db.query("INSERT INTO users SET ?", user)
  return res.status(200).json({
    success: true,
    message: 'User berhasil ditambahkan'
  })
})

async function getPowerHistory() {
  let result = await powerService.getPowerHistory()
  result = result.map(item => ({
    ...item,
    time: moment(item.created_at).format('HH:mm'),
  }))
  return result
}

const dummySld = {
  pms1: 1,
  pms2: 1,
  cb150: 1,
  trafo: 1,
  cb20: 1,
}

const dummyMeasurement = [
  {
    name: 'V',
    value: '0',
    unit: 'V'
  },
  {
    name: 'I',
    value: '0',
    unit: 'A'
  },
  {
    name: 'P',
    value: '0',
    unit: 'watt'
  },
  {
    name: 'Q',
    value: '0',
    unit: 'mVar'
  },
  {
    name: 'f',
    value: '0',
    unit: 'Hz'
  },
]

const dummyStatus = [
  {
    name: 'HV trip',
    isError: false,
    isBlink: false,
  },
  {
    name: 'LV Trip',
    isError: false,
    isBlink: false
  },
  {
    name: 'MCB AC Trip',
    isError: false,
    isBlink: false,
  },
  {
    name: 'MCB DC trip',
    isError: false,
    isBlink: false
  }
]

const actionButton = [
  {
    name: 'Acknowledge',
    id: 'ack'
  },{
    name: 'Reset',
    id: 'reset'
  },
]


async function getStatus(){
  const [data] = await db.query('SELECT * FROM status')
  if(data.length > 0){
    const status = data.map(item => {
      return {
        name: item.name,
        isError: item.is_error == 1,
        isBlink: item.is_blink == 1,
      }
    })
    io.sockets.emit('status', status)
  } else {
    io.sockets.emit('status', dummyStatus)
  }
}

async function sendLastMeasurement(){
  const [measurement] = await db.query('SELECT * FROM measurement ORDER BY id ASC')
  if(measurement.length > 0) {
    io.sockets.emit('measurement', measurement)
  } else {
    io.sockets.emit('measurement', dummyMeasurement)
  }
}

async function sendSldStatus(){
  const [sld] = await db.query('SELECT * FROM sld WHERE id=1')
  io.sockets.emit('sld', sld[0] ?? dummySld) 
}

// Socket.io event handler
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle a custom event using an async function

  socket.on('init', async () => {
    const result = await getPowerHistory()
    socket.emit('chart', result);

    await Promise.all([
      sendLastMeasurement(),
      sendSldStatus(),
      getStatus()
    ])
    socket.emit('actionButton', actionButton)
  })

  socket.on("reqChart", async()=> {
    const result = await getPowerHistory()
    socket.emit('chart', result);
  })

  socket.on('sendNotification', async (data) => {
    notification.sendNotification({
      message: data
    })
  })
  
  socket.on('ack', async () => {
    await db.query(`UPDATE status SET is_blink = '0', last_ack=NOW() WHERE is_blink = '1'`)
  })

  socket.on('action', async (action) => {
    if (action === 'ack') {
      await db.query(`UPDATE status SET is_blink = '0', last_ack=NOW() WHERE is_blink = '1'`)
    } else if (action === 'reset') {
      await db.query(`UPDATE status SET is_blink = '0', is_error='0'`)
    }
    await Promise.all([
      firestore.collection('status').doc('first').update({anomali: 0, hvt: 0, lvt: 0}),
      getStatus()
    ])
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});
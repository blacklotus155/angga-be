const { db } = require('../db')

const getPowerHistory = async () => {
  const [results] = await db.query('SELECT * FROM power_history ORDER BY ID DESC LIMIT 24')
  return results
}

module.exports = {
  getPowerHistory
}
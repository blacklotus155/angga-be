exports.isLogin = (req, res, next) =>{
  if (req.session.user) {
      // User is logged in, proceed to the protected route
      next();
  } else {
      // User is not logged in, redirect to the login page
      res.redirect('/login');
  }
}
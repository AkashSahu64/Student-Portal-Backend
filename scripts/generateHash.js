const bcrypt = require('bcryptjs');

const password = 'admin123';
bcrypt.genSalt(10).then(salt => {
  bcrypt.hash(password, salt).then(hash => {
    console.log('Hashed password:', hash);
  });
});
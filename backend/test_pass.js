const bcrypt = require('bcryptjs');

const hash = "$2b$12$6.xkqqXXgrE2dWKNhWaHQe.IByPK2okNWGqU.FJh7sskrPfI2ZHLbu";

bcrypt.compare('password123', hash).then(res => {
    console.log('password123 is valid?', res);
});
bcrypt.compare('admin123', hash).then(res => {
    console.log('admin123 is valid?', res);
});
bcrypt.compare('superadmin123', hash).then(res => {
    console.log('superadmin123 is valid?', res);
});

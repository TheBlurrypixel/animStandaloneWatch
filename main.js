var spawn = require('child_process').spawn;
const path = require('path');

var pathToFile = path.join(__dirname, 'bgService.js');
console.log(pathToFile);

spawn('node', [pathToFile], {
    stdio: 'ignore', // piping all stdio to /dev/null
    detached: true
}).unref();
// var gulp = require('./node_modules/gulp')
// require('./gulpfile')
//
// console.log = function() {};
//
// if (gulp.task('watch')) {
//     console.log('gulpfile contains task!');
//     gulp.task('watch')( () => {console.log("running watch")} );
//     // gulp.series('default', (res) => {
//     //   console.log('returning from default');
//     //   res();
//     // });
// }

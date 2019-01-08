// process.title ="got nothing to hide";
// console.log("process name=\"" + process.title + "\"");
//
var gulp = require('./node_modules/gulp')
require('./gulpfile')

//console.log(gulp.task('default'));
if (gulp.task('watch')) {
    console.log('gulpfile contains task!');
    gulp.task('watch')( () => {console.log("running watch")} );
    // gulp.series('default', (res) => {
    //   console.log('returning from default');
    //   res();
    // });
}

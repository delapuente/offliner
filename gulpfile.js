
'use strict';

var gulp = require('gulp');
var yuidoc = require('gulp-yuidoc');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var webserver = require('gulp-webserver');
var jshint = require('gulp-jshint');
var watch = require('gulp-watch');
var karma = require('karma').server;

gulp.task('tests', function () {
  karma.start({
    configFile: __dirname + '/testing/karma.conf.js',
    singleRun: true
  });
});

gulp.task('dist', function() {
  [
    'offliner-client.js',
    'offliner.js'
  ].forEach(function (source) {
    var path = 'src/' + source;
    gulp.src(path)
        .pipe(uglify())
        .pipe(rename(minName(source)))
        .pipe(gulp.dest('./dist'));

    gulp.src(path)
        .pipe(uglify({ mangle: false }))
        .pipe(gulp.dest('./dist'));
  });

  function minName(path) {
    var tokens = path.split('.');
    tokens.splice(tokens.length - 1, 0, 'min');
    return tokens.join('.');
  }
});

gulp.task('docs', function() {
  gulp.src('./src/*.js')
      .pipe(yuidoc())
      .pipe(gulp.dest('./docs'));
});

gulp.task('webserver', function() {
  gulp.src('.')
      .pipe(webserver({
        livereload: true,
        directoryListing: true,
        open: true
      }));
});

gulp.task('watch', function() {
  gulp.watch('./src/*', ['lint', 'docs', 'dist']);
});

gulp.task('lint', function() {
  return gulp.src(['./src/*.js'])
      .pipe(jshint())
      .pipe(jshint.reporter('default'));
});

gulp.task('default', ['lint','docs','dist']);

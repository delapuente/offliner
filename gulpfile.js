
'use strict';

var gulp = require('gulp');
var yuidoc = require('gulp-yuidoc');
var uglify = require('gulp-uglify');
var webserver = require('gulp-webserver');
var jshint = require('gulp-jshint');
var watch = require('gulp-watch');

gulp.task('dist', function() {
  gulp.src('src/offliner.js')
      .pipe(uglify({outSourceMap: './dist/offliner.js.map'}))
      .pipe(gulp.dest('./dist/offliner.min.js'));
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

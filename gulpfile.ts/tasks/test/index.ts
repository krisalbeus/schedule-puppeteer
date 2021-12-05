import { Logger } from '@tmap/logger';
import chalk from 'chalk';
import eslint from 'gulp-eslint';
import fs from 'fs';
import gulp from 'gulp';
import gulpIf from 'gulp-if';
import mkdirp from 'mkdirp';
import path from 'path';
import reporter from 'eslint-html-reporter';
import { spawn } from 'child_process';
import { spawnIt } from '../../libs';

const logger = Logger.create('tmap:gulp:test');

// Add Public tasks here
const publicTasks = (gulp: any) => {
  gulp.task('test:all', gulp.parallel(esLint, unit, yarnAudit));
  gulp.task('test:lint', esLint);
  gulp.task('test:unit', unit);
};

export { publicTasks as test };

const projectRoot = path.join(__dirname, '..', '..', '..');
const reportsDir = path.join(projectRoot, 'tests', 'reports');

// Tasks
const unit = () =>
  spawnIt('nyc', ['mocha', '"src/**/*.test.ts"']).then(() =>
    logger.info(
      `${chalk.grey('[Coverage]')} Report HTML ` +
        (process.env.JENKINS_URL
          ? `linked in build sidebar`
          : `saved to ${path.resolve(reportsDir, 'Coverage', 'index.html')}`)
    )
  );
const esLint = () => {
  const configFile = path.resolve(projectRoot, '.eslintcommitrc');
  const reportDir = path.resolve(reportsDir, 'ESLint');

  mkdirp.sync(reportDir);
  return gulp
    .src(JSON.parse(fs.readFileSync(path.resolve(projectRoot, 'tsconfig.json'), 'utf-8')).include)
    .pipe(eslint({ configFile, fix: true }))
    .pipe(eslint.format())
    .pipe(
      gulpIf(
        isFixed,
        gulp.dest((file) => file.base)
      )
    )
    .pipe(
      eslint.format(reporter, (results: any) => {
        fs.writeFileSync(path.resolve(reportDir, 'index.html'), results);
      })
    )
    .pipe(eslint.failAfterError());
};

const yarnAudit = () => {
  const reportDir = path.resolve(reportsDir, 'Audit');
  mkdirp.sync(reportDir);
  const child1 = spawn('yarn', ['audit', '--json', '--groups', 'dependencies']);
  const child2 = spawn('yarn-audit-html', ['--fatal-exit-code', '--output', path.resolve(reportDir, 'index.html')]);

  return new Promise<void>((resolve, reject) => {
    child1.stdout.pipe(child2.stdin);
    child2.stdout.on('data', (data) => {
      logger.info(data.toString());
    });
    child1.on('exit', (code) => {
      if (code && code >= Number(process.env.YARN_AUDIT_EXIT_CODE_THRESHOLD)) {
        reject(
          chalk.red(
            'Production dependency vulnerabilities check ' +
              (process.env.JENKINS_URL
                ? 'Test Report - Audit" html report linked in build side bar!'
                : `report saved to ${path.resolve(reportDir, 'index.html')}!`)
          )
        );
      }
    });
    child2.on('error', reject).on('exit', resolve);
  });
};

const isFixed = (file: any) => file.eslint?.fixed;

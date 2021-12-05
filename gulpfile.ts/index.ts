import { GulpTasks } from '@tmap/serverless';
import { cloudformationOutputs } from './libs';
import gulp from 'gulp';
import { test } from './tasks/test';

const serverless = new GulpTasks(cloudformationOutputs);

serverless.publicTasks(gulp);
test(gulp);
// Orchestration across namespaces here
gulp.task('deploy', gulp.series(serverless.tasks.deploy));

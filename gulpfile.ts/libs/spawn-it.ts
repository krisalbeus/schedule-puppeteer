// gulp-shell plugin use to do this!
import { spawn } from 'child_process';

export const spawnIt = (command: string, args: string[], options?: any) =>
  new Promise((resolve, reject) => {
    const ls = spawn(command, args, { shell: true, stdio: 'inherit', ...options });
    ls.on('err', (err) => {
      reject(err);
    });
    ls.on('exit', (code) => {
      // process.stdout.write('child process exited with code ' + code!.toString());
      if (code === 0) {
        resolve('complete');
      } else {
        reject(code);
      }
    });
  });

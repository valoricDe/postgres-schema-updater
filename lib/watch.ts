import {watch as initWatcher} from 'chokidar'

export const watch = (source, callback, log) => {
  const watcher = initWatcher(source, {
    persistent: true,
    ignoreInitial: true,
  })

  watcher
    .on('add', (path) => {
      log.always(`File ${path} has been added`)
      callback()
    })
    .on('change', (path) => {
      log.always(`File ${path} has been changed`)
      callback()
    })
    .on('unlink', (path) => {
      log.always(`File ${path} has been removed`)
      callback()
    })
    .on('addDir', (path) => {
      log.always(`Directory ${path} has been added`)
      callback()
    })
    .on('unlinkDir', (path) => {
      log.always(`Directory ${path} has been removed`)
      callback()
    })
    .on('error', error => console.log(`Watcher error: ${error}`))
    .on('ready', () => console.log('Initial scan complete. Ready for changes'))
}

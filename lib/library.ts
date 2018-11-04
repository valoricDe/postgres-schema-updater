import { resolve } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink, rename, exists } from 'fs'
import * as pgPromise from 'pg-promise'
import * as glob from 'glob'
import * as concatFiles from 'concat-files'
import * as readline from 'readline'

const globAsync = promisify(glob)
const concatAsync = promisify(concatFiles)
const unlinkAsync = promisify(unlink)
const renameAsync = promisify(rename)
const existsAsync = promisify(exists)
const execAsync = promisify(exec)
const pgp = pgPromise({ promiseLib: Promise })

const unlinkIfExists = (path) => unlinkAsync(path)
  .catch((err) => {
    if (err.code === 'ENOENT')
      console.log(`${path} does not exists`)
    else
      throw err
  })

export const ask = (question, log) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question + ' [y,n] ', (answer) => {
      if (answer.indexOf('y') === 0) {
        resolve(true)
      }
      else if (answer.indexOf('n') === 0) {
        resolve(false)
      }
      else {
        log.always('Could not parse input, please choose yes or no')
        return ask(question, log)
      }
      rl.close()
    })
  })
}

export const initCompareByConcat = (program, log) => {
  return existsAsync(program.compare)
    .then((compareExists) => {
      if (!compareExists) {
        log.always('File for comparing combined sql files to does not exists: ' + program.compare)

        return ask('Create file from combined sql files?', log)
          .then(accepted => {
            if (accepted) {
              return concat(program, program.compare, false, log)
            }
          })
          .then(() => {
            log.always('Please restart')
            process.exit(0)
          })
          .catch(console.error)
      }
    })
}

export const concat = (program, output, unlinkBefore, log) => {
  return Promise.all([
      globAsync(program.source),
      unlinkBefore ? unlinkIfExists(output) : Promise.resolve(),
    ])
    .then((data) => {
      const fileNames = data[0]
      log.verbose('processing files: ', fileNames)

      return concatAsync(fileNames, output)
        .then((res) => {
          log.verbose('concatenated files and saved into: ', output)
          return res
        })
    })
}

export const compare = (program, log) => {
  const apgDiffPath = resolve(__dirname+'/../../vendor/apgdiff-2.5next/apgdiff-2.5.0-SNAPSHOT.jar')
  const parameter = '--ignore-start-with --add-transaction ' + program.compare + ' ' + program.tmp + ' | tee ' + program.diff

  return execAsync('java -jar ' + apgDiffPath + ' ' + parameter)
    .then(({ stdout, stderr }) => {
      if (stderr) throw new Error(stderr)

      log.verbose('Schema Diff: ' + stdout)
      return stdout
    })
}

const connections = {}

const getConnection = (connectString) => {
  if(!connections.hasOwnProperty(connectString)) {
    connections[connectString] = pgp(connectString)
  }

  return connections[connectString]
}

export const upgrade = (program, diff, log) => {
  const db = getConnection(program.connection)
  return db.query(diff)
    .then(function (result) {
      log.always('Postgres result: ', result)
    })

}

export const moveFiles = (program, log) => {
  log.always('Deleting ' + program.compare)
  return unlinkIfExists(program.compare)
    .then(() => {
      log.always('Moving ' + program.tmp + ' to ' + program.compare)
      return renameAsync(program.tmp, program.compare)
    })
}

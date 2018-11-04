#! /usr/bin/env node
import * as program from 'commander'
import { watch } from '../lib/watch'
import { compare, concat, initCompareByConcat, moveFiles, upgrade } from '../lib/library'

require('dotenv').config()

/**
 * Created by velten on 24.02.17.
 *
 * steps taken in this script:
 * 1. concatenating specified files to a tmp file ("tmpFile")
 * 2. comparing tmp file with specified staging file ("compareFile")
 * 3. executing diff on postgres server
 * 4. replacing staging file with tmp file
 */

// commander: [label] = optional value saved in program.label, <label2> = required value saved in program.label2
program
  .version('1.1.1')
  .option('-v, --verbose', 'print verbose information')
  .option('-n, --dry', 'no upgrade of database, dry run')
  .option('-c, --connection [connectionString]', 'connectionString for postgres instance', process.env.CONNECTION_STRING)
  .option('-s, --source [source]', 'source sql files (glob syntax allowed)', process.env.SOURCE)
  .option('-t, --tmp [tmpFile]', 'file used to save concatenated source files', process.env.TMP_FILE)
  .option('-f, --compare [compareFile]', 'file used to compare newest changes to', process.env.COMPARE_FILE)
  .option('-o, --output [outputFile]', 'file where newest changes are going to be written to', program.compare)
  .option('-d, --diff [upgradeDiffFile]', 'file where the diff to the compareFile is saved', 'sql/upgrade-staging.diff.sql')
  .option('-w, --watch [watch]', 'watch source files for changes and apply')
  .parse(process.argv)

const log = {
  always: console.log.bind(console),
  verbose: (...args) => {
    if (program.verbose) {
      console.log(args)
    }
  },
}

const exec = () => {
  return concat(program, program.tmp, true, log)
    .then(() => {
      return compare(program, log)
        .then(diff => {
          if (!program.dry) {
            return upgrade(program, diff, log)
              .then(() => {
                moveFiles(program, log)
              })
          }
          else
          {
            console.log('Not upgrading schema on postgres server due to dry run.')
          }
        })
    })
    .catch(console.error)
}

initCompareByConcat(program, log)
  .then(exec)
  .then(() => {
    if (program.watch) {
      watch(program.source, exec, log)
    }
  })

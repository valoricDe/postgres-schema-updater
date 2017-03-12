#! /usr/bin/env node

/**
 * Created by velten on 24.02.17.
 *
 * steps taken in this script:
 * 1. concatenating specified files to a tmp file ("tmpFile")
 * 2. comparing tmp file with specified staging file ("compareFile")
 * 3. executing diff on postgres server
 * 4. replacing staging file with tmp file
 */

const glob = require('glob');
const concat = require('concat-files');
const exec = require('child_process').exec;
const path = require('path');
const fs = require('fs');
const pgp = require('pg-promise')({
	// Initialization Options
	promiseLib: Promise
});
const readline = require('readline');
const program = require('commander');

// commander: [label] = optional value saved in program.label, <label2> = required value saved in program.label2
program
	.version('1.1.1')
	.option('-v, --verbose', 'print verbose information')
	.option('-y, --dry', 'do not update database')
	.option('-c, --connection [connectionString]', 'connectionString for postgres instance') // 'postgres://admin:test1234@localhost:5432/velten'
	.option('-s, --source [source]', 'source sql files (glob syntax allowed)', 'src/**/*sql')
	.option('-t, --tmp [tmpFile]', 'file used to save concatenated source files', 'development.sql')
	.option('-f, --compare [compareFile]', 'file used to compare newest changes to', 'staging.sql')
	.option('-o, --output [outputFile]', 'file where newest changes are going to be written to', program.compare)
	.option('-d, --diff [upgradeDiffFile]', 'file where the diff to the compareFile is saved', 'upgrade-staging.diff.sql')
	.parse(process.argv);


// if compareFile not exists shall it be set to concatenated source files?
if (!fs.existsSync(program.compare)) {
	console.log('File for comparing combined sql files to does not exists: ' + program.compare);
	let rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Create file from combined sql files? [y,n] ', (answer) => {
		if (answer === 'y') {
			glob(program.source, function (err, fileNames) {
				if (err) throw err;
				program.verbose && console.log('processing files: ', fileNames);

				concat(fileNames, program.compare, function (err) {
					if (err) throw err;
					program.verbose && console.log('Concated files and saved into ' + program.compare);
				});
			});
		}
		rl.close();
	});
	return;
}

if (fs.existsSync(program.tmp)) {
	console.log('File for temporary combined sql files to does already exists: ' + program.tmp);
	console.log('Please delete the file first!');
	return;
}

glob(program.source, function (err, fileNames) {
	if (err) throw err;
	program.verbose && console.log('processing files: ', fileNames);

	concat(fileNames, program.tmp, function (err) {
		if (err) throw err;
		program.verbose && console.log('concatenated files');

		const apgDiffPath = path.join(__dirname, '..', 'vendor', 'apgdiff-2.4', 'apgdiff-2.4.jar');
		const parameter = '--ignore-start-with --add-transaction ' + program.compare + ' ' + program.tmp + ' | tee ' + program.diff;
		const child = exec('java -jar ' + apgDiffPath + ' ' + parameter,
			function (err, stdout, stderr) {
				if (err) throw err;
				if (stderr) {
					console.error(stderr);
					return;
				}
				program.verbose && console.log('Schema Diff: ' + stdout);

				if (!program.dry) {
					let rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout
					});
					rl.question('Do you want to upgrade? [y,n] ', (answer) => {
						if (answer === 'y') {
							const db = pgp(program.connection);
							db.query(stdout)
								.then(function (result) {
									console.log('Postgres result: ', result);

									console.log('Deleting ' + program.compare);
									fs.unlinkSync(program.compare);
									console.log('Moving ' + program.tmp + ' to ' + program.compare);
									fs.rename(program.tmp, program.compare);
								})
								.catch(function (err) {
									console.error('Upgrade error: ' + err)
								});
						}
						rl.close();
					});
				}
				else {
					console.log('Not upgrading schema on postgres server due to dry run.');
				}
			});
	});
});

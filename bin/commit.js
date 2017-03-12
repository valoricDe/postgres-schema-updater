#! /usr/bin/env node

/**
 * Created by velten on 24.02.17.
 *
 * steps taken in this script:
 * 1. comparing staging and live sql files and writing diff to a upgrade and downgrade file
 * 2. optional: executing down and then upgrade sql file (supply -p'' if you do not want to execute)
 * 3. optional: committing directory to git
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
const simpleGit = require('simple-git');
const program = require('commander');

// commander: [label] = optional value saved in program.label, <label2> = required value saved in program.label2
program
	.version('1.1.1')
	.option('-v, --verbose', 'print verbose information')
	.option('-a, --amend', 'git: amend commit')
	.option('-m, --message [message]', 'git commit message')
	.option('-p, --postgres [connection]', 'connection string for postgres instance')
	.option('-s, --source [sourceFile]', 'source sql files (glob syntax allowed)', 'staging.sql')
	.option('-c, --destination [destinationFile]', 'file used to compare newest changes to', 'production.sql')
	.option('--updiff [upgradeDiffFile]', 'file where the upgrade diff is saved', 'upgrade.diff.sql')
	.option('--downdiff [downgradeDiffFile]', 'file where the downgrade diff is saved', 'downgrade.diff.sql')
	.parse(process.argv);


const apgDiffPath = path.join('vendor', 'apgdiff-2.4', 'apgdiff-2.4.jar');
const upParameter = '--ignore-start-with --add-transaction ' + program.compareFile + ' ' + program.sourceFile + ' | tee ' + program.upgradeDiffFile;
const downParameter = '--ignore-start-with --add-transaction ' + program.sourceFile + ' ' + program.compareFile + ' | tee ' + program.downgradeDiffFile;

function promiseFromChildProcess(child) {
	return new Promise(function (resolve, reject) {
		child.addListener("error", reject);
		child.addListener("exit", resolve);
	});
}

function promiseFromParamOrQuestion(param, question) {
	return new Promise(function (resolve, reject) {
		if (param === undefined) {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			rl.question(question, (answeredParam) => {
				resolve(answeredParam);
				rl.close();
			});
		}
		resolve(param);
	})
}

const commandPromises = ['java -jar ' + apgDiffPath + ' ' + upParameter, 'java -jar ' + apgDiffPath + ' ' + downParameter]
	.map(command => {
		const child = exec(command);

		child.stdout.on('data', function (data) {
			console.log('stdout: ' + data);
		});
		child.stderr.on('data', function (data) {
			console.log('stderr: ' + data);
		});
		child.on('close', function (code) {
			console.log('closing code: ' + code);
		});

		return promiseFromChildProcess(child);
	});
/*
 const upDiffChild = exec('java -jar '+apgDiffPath+' '+upParameter);
 const upDiffPromise = promiseFromChildProcess(upDiffChild);

 upDiffChild.stdout.on('data', function (data) {
 console.log('stdout: ' + data);
 });
 upDiffChild.stderr.on('data', function (data) {
 console.log('stderr: ' + data);
 });
 upDiffChild.on('close', function (code) {
 console.log('closing code: ' + code);
 });

 const downDiffChild = exec('java -jar '+apgDiffPath+' '+upParameter);
 const downDiffPromise = promiseFromChildProcess(downDiffChild);

 downDiffChild.stdout.on('data', function (data) {
 console.log('stdout: ' + data);
 });
 downDiffChild.stderr.on('data', function (data) {
 console.log('stderr: ' + data);
 });
 downDiffChild.on('close', function (code) {
 console.log('closing code: ' + code);
 });*/

Promise
	.all(commandPromises)
	.then(results => {
		console.log('results', results);
		return results;
	})
	.then(results => promiseFromParamOrQuestion(program.connection, 'Enter postgres connection string if you want to execute down and up diff: ')
		.then(connectionString => {
			if (connectionString.trim().length <= 0) {
				return;
			}

			const db = pgp(connectionString);
			const queryPromises = results.map(r => db.query(r));

			return Promise.all(queryPromises).then(function (queryResults) {
				console.log('Postgres result: ', queryResults);
			});
		})
	)
	.then(() => {
		console.log('Copying ' + program.sourceFile + ' to ' + program.destinationFile);
		return fs.createReadStream(program.sourceFile).pipe(fs.createWriteStream(program.destinationFile));
	})
	.then(() => promiseFromParamOrQuestion(program.message, 'Enter a git commit message if you want to save your changes: ')
		.then((message) => {
				const gitRepo = simpleGit('.');
				gitRepo.outputHandler(function (command, stdout, stderr) {
					stdout.pipe(process.stdout);
					stderr.pipe(process.stderr);
				});

				gitRepo.add('.').commit(message, program.amend ? {'-a': null} : {});
			}
		)
	)
	.catch(console.error);
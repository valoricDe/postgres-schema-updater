/**
 * Created by velten on 24.02.17.
 */

const glob = require('glob');
const concat = require('concat-files');
const exec = require('child_process').exec;
const path = require('path');
const simpleGit = require('simple-git');

console.log('New directory: ' + process.cwd());
process.chdir('..');

let amend = false;
process.argv.forEach(function (val, index, array) {
	if(val === '-a' || val === '--amend') amend = true;
});

var gitRepo = simpleGit('.');
gitRepo.outputHandler(function (command, stdout, stderr) {
	stdout.pipe(process.stdout);
	stderr.pipe(process.stderr);
});

glob("*.sql", function (err, files) {
	if(err) throw err;
	console.log('read files: ', files);

	concat(files, 'build.sql', function(err) {
		if (err) throw err;
		console.log('concated files');
		const apgDiffPath = path.join('vendor', 'apgdiff', 'apgdiff-2.4.jar');

		const parameter = '--ignore-start-with production.sql development.sql > upgrade.sql';
		const child = exec('java -jar '+apgDiffPath+' ',
			function (error, stdout, stderr){
				console.log('Output -> ' + stdout);
				if(error !== null){
					console.log("Error -> "+error);
				}
			});

/*		gitRepo
			.add('.')
			.commit('save content')
			.push('origin', 'master');

		response.end('saved');

		gitRepo
		// do not output full log history on server stdout
			.outputHandler(function (command, stdout, stderr) {})
			.log(['--oneline'], function (err, log) {
				if (!ServerError(err)) {
					var data = JSON.stringify({version: log.total, hash: log.latest.hash.split(' ', 1)[0]});
					fs.writeFile(versionPath, data, function (err) {
						ServerError(err);
					});
				}
			});*/
	});
});

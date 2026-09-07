#!/usr/bin/env bash
#
# Install the PhantomJS-based QUnit runner for `grunt qunit`.
#
# Why this is not a devDependency
# -------------------------------
# package.json is a packed member of the published tarball and its bytes have
# to match the release exactly, so grunt-contrib-qunit cannot be added to
# devDependencies. It is installed here instead, out of band, and the Gruntfile
# loads it with an explicit grunt.loadNpmTasks() because load-grunt-tasks only
# discovers what package.json declares.
#
# Why --ignore-scripts, and the location.js write
# -----------------------------------------------
# grunt-contrib-qunit 0.4.0 (the release current on 2014-05-01) depends on
# grunt-lib-phantomjs 0.5.0, which resolves the browser with
# `require("phantomjs").path`. That path comes from lib/location.js, a file the
# phantomjs npm package's install.js writes at install time. That install.js:
#
#   * does NOT honour PHANTOMJS_BIN -- that came later. Its only reuse path is
#     `which phantomjs`, and it accepts the result only when `phantomjs
#     --version` matches its own version *exactly* ("PhantomJS is already
#     installed at ..."). The era-appropriate phantomjs@1.9.7-5 wants 1.9.7,
#     while Travis precise preinstalls 1.9.8, so the reuse path never fires.
#   * therefore falls through to downloading a tarball from
#     cdn.bitbucket.org/ariya/phantomjs, which has been dead for years, and
#     the install fails.
#
# So the download is skipped entirely with --ignore-scripts and location.js is
# written to point at the phantomjs already on this machine. Nothing is
# faked: the binary named in location.js is the real browser that runs the
# suite, and its version is printed below.

set -euo pipefail

QUNIT_TASK_VERSION="0.4.0"

# --------------------------------------------------------------- phantomjs --

if [ -n "${PHANTOMJS_BIN:-}" ] && [ -x "${PHANTOMJS_BIN}" ]; then
	PHANTOM="$PHANTOMJS_BIN"
elif command -v phantomjs >/dev/null 2>&1; then
	PHANTOM="$( command -v phantomjs )"
else
	echo "install-qunit-runner: no phantomjs found." >&2
	echo "  Travis's precise images preinstall PhantomJS 1.9.x; set" >&2
	echo "  PHANTOMJS_BIN if it lives somewhere off PATH." >&2
	exit 1
fi

echo "--- QUnit runner"
echo "phantomjs: $PHANTOM ($( "$PHANTOM" --version ))"
echo "node:      $( node --version )"
echo "npm:       $( npm --version )"
echo "registry:  $( npm config get registry )"

# ------------------------------------------------------------------ install --

# Resolves against whatever registry before_install configured, so the version
# solve stays inside the release-date snapshot.
npm install --ignore-scripts "grunt-contrib-qunit@${QUNIT_TASK_VERSION}"

# npm nests its own phantomjs copy under grunt-lib-phantomjs, and which version
# it picks depends on the registry snapshot, so point every copy that exists at
# the system browser and verify each one resolves. Failing here, with the path
# in the message, beats an opaque "spawn ENOENT" from the grunt task later.
found=0
for lib in $( find node_modules -type d -path "*/phantomjs/lib" ); do
	echo "module.exports.location = \"$PHANTOM\"" > "$lib/location.js"

	# The time-machine registry resolves phantomjs@1.9.0-6, which predates
	# location.js entirely and hardcodes lib/phantom/bin/phantomjs. Point that
	# path at the same real browser so either module layout resolves to it.
	mkdir -p "$lib/phantom/bin"
	ln -sf "$PHANTOM" "$lib/phantom/bin/phantomjs"
	found=$(( found + 1 ))

	node -e '
		var fs = require( "fs" ),
			moduleDir = process.argv[ 1 ],
			expected = process.argv[ 2 ],
			resolved = require( moduleDir ).path;

		// Either wiring is fine as long as the path lands on the same real
		// browser: newer copies read location.js, 1.9.0-6 reads the symlink
		// planted at lib/phantom/bin/phantomjs.
		if ( fs.realpathSync( resolved ) !== fs.realpathSync( expected ) ) {
			throw new Error( "phantomjs wiring did not take for " + moduleDir +
				": require(...).path is " + resolved + ", which is not " + expected );
		}
		console.log( "ok " + moduleDir + " -> " + resolved );
	' "$( cd "$lib/.." && pwd )" "$PHANTOM"
done

if [ "$found" = "0" ]; then
	echo "install-qunit-runner: no phantomjs module found to point at $PHANTOM" >&2
	echo "  grunt-contrib-qunit@${QUNIT_TASK_VERSION} should have pulled one in" >&2
	echo "  via grunt-lib-phantomjs; check the npm install output above." >&2
	exit 1
fi

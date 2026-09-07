module.exports = function( grunt ) {
	"use strict";

	function readOptionalJSON( filepath ) {
		var data = {};
		try {
			data = grunt.file.readJSON( filepath );
		} catch ( e ) {}
		return data;
	}

	var fs = require( "fs" ),
		gzip = require( "gzip-js" ),
		srcHintOptions = readOptionalJSON( "src/.jshintrc" ),

		// The QUnit suite is served over HTTP so that testinit.js leaves
		// isLocal false and the ajax/network tests actually run. Keep in sync
		// with the port test/manage-test-server.sh binds.
		testPort = process.env.JQUERY_TEST_PORT || "8000";

	// The concatenated file won't pass onevar
	// But our modules can
	delete srcHintOptions.onevar;

	grunt.initConfig({
		pkg: grunt.file.readJSON( "package.json" ),
		dst: readOptionalJSON( "dist/.destination.json" ),
		compare_size: {
			files: [ "dist/jquery.js", "dist/jquery.min.js" ],
			options: {
				compress: {
					gz: function( contents ) {
						return gzip.zip( contents, {} ).length;
					}
				},
				cache: "build/.sizecache.json"
			}
		},
		build: {
			all: {
				dest: "dist/jquery.js",
				minimum: [
					"core",
					"selector"
				],
				removeWith: {
					ajax: [ "manipulation/_evalUrl" ],
					callbacks: [ "deferred" ],
					css: [ "effects", "dimensions", "offset" ]
				}
			}
		},
		bowercopy: {
			options: {
				clean: true
			},
			src: {
				files: {
					"src/sizzle/dist": "sizzle/dist",
					"src/sizzle/test/data": "sizzle/test/data",
					"src/sizzle/test/unit": "sizzle/test/unit",
					"src/sizzle/test/index.html": "sizzle/test/index.html",
					"src/sizzle/test/jquery.js": "sizzle/test/jquery.js"
				}
			},
			tests: {
				options: {
					destPrefix: "test/libs"
				},
				files: {
					"qunit": "qunit/qunit",
					"require.js": "requirejs/require.js",
					"sinon/fake_timers.js": "sinon/lib/sinon/util/fake_timers.js",
					"sinon/timers_ie.js": "sinon/lib/sinon/util/timers_ie.js"
				}
			}
		},
		jsonlint: {
			pkg: {
				src: [ "package.json" ]
			},

			bower: {
				src: [ "bower.json" ]
			}
		},
		jshint: {
			all: {
				src: [
					"src/**/*.js", "Gruntfile.js", "test/**/*.js", "build/tasks/*",
					"build/{bower-install,release-notes,release}.js"
				],
				options: {
					jshintrc: true
				}
			},
			dist: {
				src: "dist/jquery.js",
				options: srcHintOptions
			}
		},
		jscs: {
			src: "src/**/*.js",
			gruntfile: "Gruntfile.js",

			// Right know, check only test helpers
			test: [ "test/data/testrunner.js", "test/data/testinit.js" ],
			tasks: "build/tasks/*.js"
		},
		qunit: {
			all: {
				options: {

					// The suite streams progress continuously, but a single
					// effects or ajax test can outlast the 5s default gap
					// between bridge messages on a loaded CI box.
					timeout: 180000,

					// An explicit URL (rather than a src filepath) is what
					// keeps the page on http:// instead of file://.
					urls: [
						"http://localhost:" + testPort + "/test/index.html?dev"
					],

					// Replaces grunt-contrib-qunit's own QUnit<->PhantomJS
					// bridge with a copy that survives the ajax module
					// swapping out window.JSON; see test/phantom-bridge.js.
					inject: "test/phantom-bridge.js"
				}
			}
		},
		testswarm: {
			tests: "ajax attributes callbacks core css data deferred dimensions effects event manipulation offset queue selector serialize support traversing".split( " " )
		},
		watch: {
			files: [ "<%= jshint.all.src %>" ],
			tasks: "dev"
		},
		uglify: {
			all: {
				files: {
					"dist/jquery.min.js": [ "dist/jquery.js" ]
				},
				options: {
					preserveComments: false,
					sourceMap: "dist/jquery.min.map",
					sourceMappingURL: "jquery.min.map",
					report: "min",
					beautify: {
						ascii_only: true
					},
					banner: "/*! jQuery v<%= pkg.version %> | " +
						"(c) 2005, 2014 jQuery Foundation, Inc. | " +
						"jquery.org/license */",
					compress: {
						hoist_funs: false,
						loops: false,
						unused: false
					}
				}
			}
		}
	});

	// Load grunt tasks from NPM packages
	require( "load-grunt-tasks" )( grunt );

	// grunt-contrib-qunit cannot be a devDependency: package.json is a packed
	// tarball member whose bytes must match the published release. CI installs
	// it out-of-band, so load-grunt-tasks (which reads package.json) never
	// sees it -- load it explicitly, and only when it is actually present so
	// that a plain `grunt` build with no test tooling still succeeds.
	if ( fs.existsSync( "./node_modules/grunt-contrib-qunit" ) ) {
		grunt.loadNpmTasks( "grunt-contrib-qunit" );
	}

	// Integrate jQuery specific tasks
	grunt.loadTasks( "build/tasks" );

	grunt.registerTask( "bower", "bowercopy" );
	grunt.registerTask( "lint", [ "jshint", "jscs" ] );

	// Short list as a high frequency watch task
	grunt.registerTask( "dev", [ "build:*:*", "lint" ] );

	// Default grunt
	grunt.registerTask( "default", [ "jsonlint", "dev", "uglify", "dist:*", "compare_size" ] );
};

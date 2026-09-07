// QUnit <-> PhantomJS bridge for the `grunt qunit` run.
//
// This is grunt-contrib-qunit 0.4.0's own phantomjs/bridge.js (MIT, (c) 2013
// "Cowboy" Ben Alman and contributors) with one deliberate change: the
// reference to JSON.stringify is captured once, when the bridge is injected,
// instead of being resolved from the global scope on every message.
//
// Why it has to be captured: the bridge reports every QUnit event to the grunt
// process as alert( JSON.stringify( ... ) ). test/unit/ajax.js's
// "jQuery.getJSON() - Using Native JSON" replaces window.JSON with a stub that
// implements only parse(), and makes an assertion from inside that parse() --
// so with the stock bridge the first message sent while the stub is installed
// throws "JSON.stringify is not a function", the reporting channel dies
// mid-test, and the whole run ends in a PhantomJS timeout instead of a result.
//
// The tidier fix -- re-grafting stringify onto whatever object the page
// installs, via an accessor on window.JSON -- is not available here:
// PhantomJS 1.9's JavaScriptCore exposes window.JSON as a non-configurable
// property, so Object.defineProperty on it throws.
//
// Wired up through the qunit task's `inject` option; see Gruntfile.js.
( function() {
	"use strict";

	var stringify = window.JSON.stringify;

	// Don't re-order tests.
	QUnit.config.reorder = false;

	// Run tests serially, not in parallel.
	QUnit.config.autorun = false;

	// Send messages to the parent PhantomJS process via alert! Good times!!
	function sendMessage() {
		var args = [].slice.call( arguments );
		alert( stringify( args ) );
	}

	// These methods connect QUnit to PhantomJS.
	QUnit.log( function( obj ) {
		var actual, expected;

		// What is this I don't even
		if ( obj.message === "[object Object], undefined:undefined" ) {
			return;
		}

		// Parse some stuff before sending it.
		actual = QUnit.jsDump.parse( obj.actual );
		expected = QUnit.jsDump.parse( obj.expected );

		// Send it.
		sendMessage( "qunit.log", obj.result, actual, expected, obj.message,
			obj.source );
	} );

	QUnit.testStart( function( obj ) {
		sendMessage( "qunit.testStart", obj.name );
	} );

	QUnit.testDone( function( obj ) {
		sendMessage( "qunit.testDone", obj.name, obj.failed, obj.passed,
			obj.total );
	} );

	QUnit.moduleStart( function( obj ) {
		sendMessage( "qunit.moduleStart", obj.name );
	} );

	QUnit.moduleDone( function( obj ) {
		sendMessage( "qunit.moduleDone", obj.name, obj.failed, obj.passed,
			obj.total );
	} );

	QUnit.begin( function() {
		sendMessage( "qunit.begin" );
	} );

	QUnit.done( function( obj ) {
		sendMessage( "qunit.done", obj.failed, obj.passed, obj.total,
			obj.runtime );
	} );
}() );

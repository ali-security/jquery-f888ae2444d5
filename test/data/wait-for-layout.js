// Defer a fixture's setup until its first layout has landed.
//
// Qt WebKit (PhantomJS 1.9) lays a freshly navigated iframe out
// asynchronously and does not flush layout on demand, so at document-ready
// every element in the fixture still measures 0. Anything that needs real
// geometry gets the wrong answer if it runs at ready:
//
//   * jQuery's lazily computed support probes (boxSizingReliable,
//     shrinkWrapBlocks) decide from an element's offsetWidth, so they resolve
//     to the opposite of what the same browser reports on a laid-out page.
//   * assigning scrollTop/scrollLeft to an overflow container is a no-op
//     while the container has no scrollable extent yet.
//
// Fixtures call whenLaidOut() to run that work against real geometry. It also
// flips window.fixtureReady, which testIframe() in test/data/testinit.js
// waits on before measuring, so the parent cannot race the fixture.
window.fixtureReady = false;

window.whenLaidOut = function( callback ) {
	var waited = 0,
		interval = window.setInterval( function() {
			if ( document.body.offsetHeight > 0 || ++waited > 100 ) {
				window.clearInterval( interval );
				window.fixtureReady = true;
				callback();
			}
		}, 15 );
};

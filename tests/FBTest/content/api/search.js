/* See license.txt for terms of usage */

/**
 * This file defines Search APIs for test drivers.
 */

(function() {

// ********************************************************************************************* //
// Constants

// Must be synchronized with nsICompositionStringSynthesizer.
const COMPOSITION_ATTR_RAWINPUT              = 0x02;
const COMPOSITION_ATTR_SELECTEDRAWTEXT       = 0x03;
const COMPOSITION_ATTR_CONVERTEDTEXT         = 0x04;
const COMPOSITION_ATTR_SELECTEDCONVERTEDTEXT = 0x05;

// ********************************************************************************************* //
// Search API

this.clearSearchField = function(callback)
{
    // FIX ME: characters should be sent into the search box individually
    // (using key events) to simulate incremental search.
    var searchBox = FW.Firebug.chrome.$("fbSearchBox");
    searchBox.value = "";

    var doc = searchBox.ownerDocument;
    doc.defaultView.focus();
    FBTest.focus(searchBox);

    FBTest.sendKey("RETURN", "fbSearchBox");

    if (callback)
    {
        // Firebug uses search delay so, we need to wait till the panel is updated
        // (see firebug/chrome/searchBox module, searchDelay constant).
        setTimeout(function() {
            callback()
        }, 250);
    }
}

this.getSearchFieldText = function()
{
    return FW.Firebug.chrome.$("fbSearchBox").value;
}

this.setSearchFieldText = function(searchText, callback)
{
    FBTest.clearSearchField(function()
    {
        // Focus the search box.
        var searchBox = FW.Firebug.chrome.$("fbSearchBox");
        var doc = searchBox.ownerDocument;
        doc.defaultView.focus();
        FBTest.focus(searchBox);

        // Send text into the input box.
        FBTest.synthesizeText(searchText, doc.defaultView);
        FBTest.sendKey("RETURN", "fbSearchBox");

        if (callback)
        {
            // Firebug uses search delay so, we need to wait till the panel is updated
            // (see firebug/chrome/searchBox module, searchDelay constant).
            setTimeout(function() {
                callback()
            }, 250);
        }
    });
}

/**
 * Executes search within the Script panel.
 * @param {String} searchText Keyword set into the search box.
 * @param {Function} callback Function called as soon as the result has been found.
 */
this.searchInScriptPanel = function(searchText, callback)
{
    FBTest.selectPanel("script");

    var config =
    {
        tagName: "div",
        classes: "CodeMirror-highlightedLine"
    };

    FBTest.waitForDisplayedElement("script", config, function(element)
    {
        // Wait till CodeMirror-highlightedLine is removed.
        var attributes = {"class": "CodeMirror-highlightedLine"}
        var doc = FBTestFirebug.getPanelDocument();
        var recognizer = new MutationRecognizer(doc.defaultView, config.tagName,
            null, null, attributes);
        recognizer.onRecognizeAsync(callback);
    });

    // Set search string into the search box.
    var searchBox = FW.Firebug.chrome.$("fbSearchBox");

    // FIXME: characters should be sent into the search box individually
    // (using key events) to simulate incremental search.
    searchBox.value = searchText;

    // Setting the 'value' property doesn't fire an 'input' event so,
    // press enter instead (asynchronously).
    FBTest.sendKey("RETURN", "fbSearchBox");
};

/**
 * Executes search within the CSS panel.
 * @param {String} searchText Keyword set into the search box.
 * @param {Function} callback Function called as soon as the result has been found.
 */
this.searchInCssPanel = function(searchText, callback)
{
    // FIXME: xxxpedro variable not used
    var panel = FBTest.selectPanel("stylesheet");

    var config =
    {
        tagName: "div",
        classes: "jumpHighlight"
    };

    FBTest.waitForDisplayedElement("stylesheet", config, function(element)
    {
        // Wait till jumpHighlight is removed.
        var attributes = {"class": "jumpHighlight"}
        var doc = FBTestFirebug.getPanelDocument();
        var recognizer = new MutationRecognizer(doc.defaultView, config.tagName,
            null, null, attributes);
        recognizer.onRecognizeAsync(callback);
    });

    // Set search string into the search box
    var searchBox = FW.Firebug.chrome.$("fbSearchBox");

    // FIX ME: characters should be sent into the search box individually
    // (using key events) to simulate incremental search.
    searchBox.value = searchText;

    // Setting the 'value' property doesn't fire an 'input' event so,
    // press enter instead (asynchronously).
    FBTest.sendKey("RETURN", "fbSearchBox");
};

/**
 * Executes search within the HTML panel.
 * @param {String} searchText Keyword set into the search box.
 * @param {Function} callback Function called as soon as the result has been found.
 */
this.searchInHtmlPanel = function(searchText, callback)
{
    var panel = FBTest.selectPanel("html");

    // Reset the search box.
    var searchBox = FW.Firebug.chrome.$("fbSearchBox");
    searchBox.value = "";

    // The listener is automatically removed when the test window
    // is unloaded in case the seletion actually doesn't occur,
    // see FBTestSelection.js
    FBTestApp.SelectionController.addListener(function selectionListener()
    {
        var sel = panel.document.defaultView.getSelection();
        if (sel && !sel.isCollapsed && sel.toString() == searchText)
        {
            FBTestApp.SelectionController.removeListener(arguments.callee);
            callback(sel);
        }
    });

    // Focus the search box.
    var doc = searchBox.ownerDocument;
    doc.defaultView.focus();
    FBTest.focus(searchBox);

    // Send text into the input box.
    this.synthesizeText(searchText, doc.defaultView);

    FBTest.sendKey("RETURN", "fbSearchBox");
};

this.synthesizeText = function(str, win)
{
    synthesizeText({
        composition: {
            string: str,
            clauses: [
                { length: str.length, attr: COMPOSITION_ATTR_RAWINPUT }
            ]
        },
        caret: { start: str.length, length: 0 }
    }, win);
}

// ********************************************************************************************* //
}).apply(FBTest);

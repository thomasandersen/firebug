var FBTestCurl = {

    HOST: FBTest.FirebugWindow.FBL.makeURI(FBTest.getHTTPURLBase()).host,

    URL_TO_REQUEST: FBTest.getHTTPURLBase() + "lib/netUtils/generateCurlCommand/server.php",

    TEST_FORM_URL: FBTest.getHTTPURLBase() + "lib/netUtils/generateCurlCommand/test-form.html",

    test_generateCurlCommand: function (httpMethod, expectedResult, callback)
    {
        FBTest.setPref("net.curlAddCompressedArgument", false);
        FBTest.openNewTab(this.TEST_FORM_URL, function(win)
        {
            FBTest.enableNetPanel(function(win)
            {
                FBTest.progress("Test result from a " + httpMethod + " request");

                FBTest.selectPanel("net").clear();
                FBTestCurl.onRequestDisplayed(function(netRow)
                {
                    var fireBug = FBTest.FirebugWindow.Firebug;
                    var file = fireBug.getRepObject(netRow);
                    var curlCommandStr = fireBug.NetMonitor.Utils.generateCurlCommand(file);
                    var result = FBTestCurl.replaceUserAgentHeader(curlCommandStr);
                    FBTest.compare(result, expectedResult,
                        "Generated cURL command from a " + httpMethod + " request result should be correct");

                    callback();
                });

                win.wrappedJSObject.submitForm(httpMethod, true);
            });
        });
    },

    replaceUserAgentHeader: function(str) {
        var replaceWithStr = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:22.0) Gecko/20100101 Firefox/22.0";
        return str.replace(/(-H 'User-Agent: ).+?(')/i, "$1" + replaceWithStr + "$2");
    },

    onRequestDisplayed: function(callback)
    {
        // Create listener for mutation events.
        var doc = FBTest.getPanelDocument();
        var recognizer = new MutationRecognizer(doc.defaultView, "tr",
            {"class": "netRow category-xhr loaded"});

        // Wait for a XHR log to appear in the Net panel.
        recognizer.onRecognizeAsync(callback);
    }

};

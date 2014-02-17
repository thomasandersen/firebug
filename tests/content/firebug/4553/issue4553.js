function runTest()
{
    FBTest.sysout("issue4553.START");

    FBTest.openNewTab(basePath + "firebug/4553/issue4553.html", function(win)
    {
        FBTest.progress("New tab opened");

        FBTest.openFirebug();
        FBTest.selectPanel("net");

        FBTest.progress("Net panel selected");
        FBTest.enableNetPanel(function(win)
        {
            FBTest.progress("Net panel enabled");

            var options = {
                tagName: "tr",
                classes: "netRow responseError"
            };

            FBTest.waitForDisplayedElement("net", options, function(netRow)
            {
                FBTest.progress("Error request displayed");

                var panelNode = FBTest.getSelectedPanel().panelNode;
                var row = panelNode.getElementsByClassName("category-html")[0];
                FBTest.click(row);

                var netInfoRow = row.nextSibling;
                FBTest.expandElements(panelNode, "netInfoHtmlTab");

                // If the test fails there would be an alert dialog that
                // causes the test to fail on timeout.
                FBTest.testDone("issue4553.DONE");
            });

        });
    });
}

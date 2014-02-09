// 1) Open test page.
// 2) Open Firebug and enable the Console panel.
// 3) Execute test on the page.
// 4) Verify UI in the Console panel.
function runTest()
{
    FBTest.sysout("issue3503.START");
    FBTest.openNewTab(basePath + "console/3503/issue3503.html", function(win)
    {
        FBTest.sysout("issue3503; Test page loaded.");

        FBTest.enableConsolePanel(function()
        {
            var doc = FBTest.getPanelDocument();
            var recognizer = new MutationRecognizer(doc.defaultView, "div",
                {"class": "logRow logRow-log"});

            recognizer.onRecognize(function(element)
            {
                var log = element.getElementsByClassName("objectBox objectBox-array")[0];
                FBTest.ok(log, "There must be a log row");

                FBTest.compare(/^\[undefined.*2999999700.*\]$/, log.textContent,
                    "The array must show 300 copies of 'undefined' and a count 2999999700");

                FBTest.testDone("issue3503; DONE");
            });

            // Run test implemented on the page.
            FBTest.click(win.document.getElementById("testButton"));
        });
    });
}

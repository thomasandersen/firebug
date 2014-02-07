function runTest()
{
    FBTest.sysout("exampleScript2.START");

    FBTest.openNewTab(basePath + "examples/exampleScript2.html", function(win)
    {
        FBTest.enableScriptPanel(function(win)
        {
            var chrome = FW.Firebug.chrome;
            var panel = chrome.selectPanel("script");

            // Set breakpoint
            var lineNo = 23;
            FBTest.setBreakpoint(chrome, null, lineNo, null, function()
            {
                FBTest.waitForBreakInDebugger(chrome, lineNo, true, function(row)
                {
                    FBTest.clickContinueButton();
                    FBTest.testDone("exampleScript2.DONE");
                });

                // Execute test script on the page.
                FBTest.clickContentButton(win, "testButton");
            });
        });
    });
}

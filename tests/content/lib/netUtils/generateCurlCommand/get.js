function runTest()
{
    FBTest.sysout("generateCurlCommand.START");

    var expectedResult = "curl '" + FBTestCurl.URL_TO_REQUEST + "?param1=12345&param2=Test%20&%20Test&param3=$&+,/:;=?@%20#%{}|\\^~[]%C2%B4%27' -H 'Host: " + FBTestCurl.HOST + "' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:22.0) Gecko/20100101 Firefox/22.0' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate' -H 'Referer: " + FBTestCurl.TEST_FORM_URL + "' -H 'Connection: keep-alive'";

    FBTestCurl.test_generateCurlCommand("GET", expectedResult, function() {
        FBTest.cleanUpTestTabs();
        FBTest.testDone("generateCurlCommand.DONE");
    });

}
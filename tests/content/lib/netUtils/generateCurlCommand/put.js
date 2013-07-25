function runTest()
{
    FBTest.sysout("generateCurlCommand.START");

    var expectedResult = "curl '" + FBTestCurl.URL_TO_REQUEST + "' -X PUT -H 'Host: " + FBTestCurl.HOST + "' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:22.0) Gecko/20100101 Firefox/22.0' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate' -H 'Content-Type: application/json; charset=UTF-8' -H 'Referer: " + FBTestCurl.TEST_FORM_URL + "' -H 'Connection: keep-alive' --data '{\"a\":\"1\", \"b\":\"2\", \"c\":\"3\"}'";

    FBTestCurl.test_generateCurlCommand("PUT", expectedResult, function() {
        FBTest.cleanUpTestTabs();
        FBTest.testDone("generateCurlCommand.DONE");
    });

}
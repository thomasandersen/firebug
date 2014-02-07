/* See license.txt for terms of usage */

define([
    "firebug/lib/object",
    "firebug/lib/trace",
    "firebug/debugger/debuggerLib",
    "firebug/debugger/breakpoints/breakpointStore",
],
function(Obj, FBTrace, DebuggerLib, BreakpointStore) {

"use strict";

// ********************************************************************************************* //
// Documentation

// This entire module (hack) can be removed as soon as the platform is fixed.
// Bug 812172 - Conditional breakpoints logic should be handled server-side

// ********************************************************************************************* //
// Constants

var Cu = Components.utils;

Cu["import"]("resource://gre/modules/devtools/dbg-server.jsm");

var TraceError = FBTrace.toError();
var Trace = FBTrace.to("DBG_BREAKPOINTS");

// ********************************************************************************************* //
// Implementation

var BreakpointActor = DebuggerServer.BreakpointActor;
var originalHit = BreakpointActor.prototype.hit;
BreakpointActor.prototype.hit = function(frame)
{
    var url = this.location.url;
    var line = this.location.line;

    var bp = BreakpointStore.findBreakpoint(url, line - 1);
    if (!bp || !bp.condition)
        return originalHit.apply(this, arguments);

    // Do not break if the condition is evaluated to false (to avoid unnecessary
    // RDP communication). This can improve performance a lot (see issue 6867).
    // Note that the client side doesn't evaluate the condition again.
    // See {@link BreakpointModule.shouldBreakDebugger}
    // Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=812172
    if (!evalCondition(frame, bp))
        return undefined;

    Trace.sysout("breakpointActor.hit; Break on conditional breakpoint");

    return originalHit.apply(this, arguments);
}

// ********************************************************************************************* //
// Helper

function evalCondition(frame, bp)
{
    try
    {
        var result = frame.eval(bp.condition);

        if (result.hasOwnProperty("return"))
        {
            result = result["return"];

            if (typeof(result) == "object")
                return DebuggerLib.unwrapDebuggeeValue(result);
            else
                return result;
        }
    }
    catch (e)
    {
        TraceError.sysout("breakpointActor.evalCondition; EXCEPTION " + e, e);
    }
}

// ********************************************************************************************* //
// Registration

return {};

// ********************************************************************************************* //
});

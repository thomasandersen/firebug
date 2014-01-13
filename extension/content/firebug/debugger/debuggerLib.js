/* See license.txt for terms of usage */
/*global define:1, Window:1, Components:1*/

define([
    "firebug/lib/trace",
    "firebug/lib/wrapper",
    "firebug/lib/xpcom",
],
function(FBTrace, Wrapper, Xpcom) {

"use strict";

// ********************************************************************************************* //
// Constants

var Cu = Components.utils;

var comparator = Xpcom.CCSV("@mozilla.org/xpcom/version-comparator;1", "nsIVersionComparator");
var appInfo = Xpcom.CCSV("@mozilla.org/xre/app-info;1", "nsIXULAppInfo");
var pre27 = (comparator.compare(appInfo.version, "27.0*") < 0);

var global = Cu.getGlobalForObject({});
Cu.import("resource://gre/modules/jsdebugger.jsm", {}).addDebuggerToGlobal(global);

// Debuggees
var dbgGlobalWeakMap = new WeakMap();

// Module object
var DebuggerLib = {};

var TraceError = FBTrace.toError();

// ********************************************************************************************* //
// Implementation

// xxxHonza: for now Firebug is accessing JSD2 API directly in some cases, but as soon
// as RDP is supported the entire DebuggerLib module should be used only on the server side.

/**
 * Unwraps the value of a debuggee object. Primitive values are also allowed
 * and are let through unharmed.
 *
 * @param obj {Debugger.Object} The debuggee object to unwrap, or a primitive
 *
 * @return {object} the unwrapped object, or the same primitive
 */
DebuggerLib.unwrapDebuggeeValue = function(obj)
{
    // If not a debuggee object, return it immediately.
    if (typeof obj !== "object" || obj === null)
        return obj;

    return Wrapper.unwrapObject(obj.unsafeDereference());
};

/**
 * Gets or creates the debuggee value of the given global object (the
 * context's current global if none specified), within the inactive debugger.
 * This is mostly useful for evaluating code in that global.
 *
 * @param {*} context The Firebug context
 * @param {Window} global The global object
 *
 * @return {Debugger.Object} The debuggee global
 */
DebuggerLib.getInactiveDebuggeeGlobal = function(context, global)
{
    global = global || context.getCurrentGlobal();

    var dbgGlobal = dbgGlobalWeakMap.get(global.document);
    if (!dbgGlobal)
    {
        var dbg = getInactiveDebuggerForContext(context);
        if (!dbg)
            return;

        // xxxFlorent: For a reason I ignore, there are some conflicts with the ShareMeNot add-on.
        // As a workaround, we unwrap the global object.
        // TODO see what cause that behavior, why, and if there are no other add-ons in that case.
        var contentView = Wrapper.getContentView(global);
        if (dbg.makeGlobalObjectReference)
        {
            dbgGlobal = dbg.makeGlobalObjectReference(contentView);
        }
        else
        {
            dbgGlobal = dbg.addDebuggee(contentView);
            dbg.removeDebuggee(contentView);
        }
        dbgGlobalWeakMap.set(global.document, dbgGlobal);

        if (FBTrace.DBG_DEBUGGER)
            FBTrace.sysout("new debuggee global instance created", dbgGlobal);
    }
    return dbgGlobal;
};

// temporary version-dependent check, should be removed when minVersion = 27
DebuggerLib._closureInspectionRequiresDebugger = function()
{
    return !pre27;
};

/**
 * Runs a callback with a debugger for a global temporarily enabled.
 *
 * Currently this throws an exception unless the Script panel is enabled, because
 * otherwise debug GCs kill us.
 */
DebuggerLib.withTemporaryDebugger = function(context, global, callback)
{
    // Pre Fx27, cheat and pass a disabled debugger, because closure inspection
    // works with disabled debuggers, and that's all we need this API for.
    if (!DebuggerLib._closureInspectionRequiresDebugger())
        return callback(DebuggerLib.getInactiveDebuggeeGlobal(context, global));

    var dbg = getInactiveDebuggerForContext(context);
    if (dbg.hasDebuggee(global))
        return callback(DebuggerLib.getInactiveDebuggeeGlobal(context, global));

    var dbgGlobal = dbg.addDebuggee(global);
    try
    {
        return callback(dbgGlobal);
    }
    finally
    {
        dbg.removeDebuggee(dbgGlobal);
    }
};

/**
 * Returns true if the frame location refers to the command entered by the user
 * through the command line.
 *
 * @param {string} frameLocation
 *
 * @return {boolean}
 */
// xxxHonza: should be renamed. It's not only related to the CommandLine, but
// to all bogus scripts, e.g. generated from 'clientEvaluate' packets.
DebuggerLib.isFrameLocationEval = function(frameFilename)
{
    return frameFilename === "debugger eval code" || frameFilename === "self-hosted";
};

// ********************************************************************************************* //
// Local Access (hack for easier transition to JSD2/RDP)

/**
 * The next step is to make this method asynchronous to be closer to the
 * remote debugging requirements. Of course, it should use Promise
 * as the return value.
 *
 * @param {Object} context
 * @param {Object} actorId
 */
DebuggerLib.getObject = function(context, actorId)
{
    try
    {
        // xxxHonza: access server side objects, of course even hacks needs
        // good architecture, refactor.
        // First option: implement a provider used by UI widgets (e.g. DomTree)
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=837723
        var threadActor = this.getThreadActor(context.browser);
        var actor = threadActor.threadLifetimePool.get(actorId);

        if (!actor && threadActor._pausePool)
            actor = threadActor._pausePool.get(actorId);

        if (!actor)
            return null;

        return this.unwrapDebuggeeValue(actor.obj);
    }
    catch (e)
    {
        TraceError.sysout("debuggerClient.getObject; EXCEPTION " + e, e);
    }
};

DebuggerLib.getThreadActor = function(browser)
{
    try
    {
        // The current connection is now accessible through the transport.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=878472
        var conn = Firebug.debuggerClient._transport._serverConnection;
        var tabList = conn.rootActor._parameters.tabList;
        var tabActor = tabList._actorByBrowser.get(browser);
        if (!tabActor)
            return null;

        return tabActor.threadActor;
    }
    catch (e)
    {
        TraceError.sysout("debuggerClient.getObject; EXCEPTION " + e, e);
    }
};

/**
 * Returns the debugger's Debugger.Object associated with a frame within the
 * passed context. If no frame is specified, the context's current global is used.
 *
 * @param {*} context
 * @param {Window} global
 *
 * @return {Debugger.Object} The debuggee global, or null if the context has
 * no debugger.
 */
DebuggerLib.getThreadDebuggeeGlobalForContext = function(context, global)
{
    var threadActor = DebuggerLib.getThreadActor(context.browser);
    if (!threadActor || !threadActor.globalDebugObject)
        return null;

    var dbgGlobal = threadActor.globalDebugObject;
    global = global || context.getCurrentGlobal();
    return dbgGlobal.makeDebuggeeValue(global).unwrap().global;
};

DebuggerLib.getThreadDebuggeeGlobalForFrame = function(frame)
{
    if (frame.script && frame.script.global)
        return frame.script.global;

    while (frame)
    {
        if (frame.type === "call")
            return frame.callee.global;

        // Even though |frame.this| returns a debuggee window, it is not the Debuggee 
        // global instance. So rather return |frame.this.global|.
        if (frame.type === "global")
            return frame.this.global;

        // Type is either "debugger" or "eval".
        frame = frame.older;
    }

    // We've gone through the frame chain, but couldn't get the global object. Abandon.
    TraceError.sysout("DebuggerLib.getThreadDebuggeeGlobalForFrame; can't get the global object");
    return null;
};

// ********************************************************************************************* //
// Frames

DebuggerLib.getCurrentFrame = function(context)
{
    var currentFrame = context.currentFrame;
    if (!currentFrame)
        return null;

    var threadActor = DebuggerLib.getThreadActor(context.browser);
    var frameActor = currentFrame.getActor();
    return threadActor._requestFrame(frameActor);
};

// ********************************************************************************************* //
// Stack Frames

DebuggerLib.getCurrentFrames = function(context)
{
    var threadActor = this.getThreadActor(context.browser);
    return onFrames.call(threadActor, {});
};

// xxxHonza: hack, the original method, returns a promise now.
// TODO: refactor
function onFrames(aRequest)
{
    if (this.state !== "paused")
    {
        return {
            error: "wrongState",
            message: "Stack frames are only available while the debuggee is paused."
        };
    }

    var start = aRequest.start ? aRequest.start : 0;
    var count = aRequest.count;

    // Find the starting frame...
    var frame = this.youngestFrame;
    var i = 0;
    while (frame && (i < start))
    {
        frame = frame.older;
        i++;
    }

    // Return request.count frames, or all remaining
    // frames if count is not defined.
    var frames = [];
    for (; frame && (!count || i < (start + count)); i++, frame=frame.older)
    {
        var form = this._createFrameActor(frame).form();
        form.depth = i;
        frames.push(form);
    }

    return frames;
}

// ********************************************************************************************* //
// Executable Lines

DebuggerLib.getNextExecutableLine = function(context, aLocation)
{
    var threadClient = this.getThreadActor(context.browser);

    var scripts = threadClient.dbg.findScripts(aLocation);
    if (!scripts.length)
        return;

    for (var i = 0; i < scripts.length; i++)
    {
        var script = scripts[i];
        var offsets = script.getLineOffsets(aLocation.line);
        if (offsets.length > 0)
            return aLocation;
    }

    scripts = threadClient.dbg.findScripts({
        url: aLocation.url,
        line: aLocation.line,
        innermost: true
    });

    for (var i = 0; i < scripts.length; i++)
    {
        var script = scripts[i];
        var offsets = script.getAllOffsets();
        for (var line = aLocation.line; line < offsets.length; ++line)
        {
            if (offsets[line])
            {
                return {
                    url: aLocation.url,
                    line: line,
                    column: aLocation.column
                };
            }
        }
    }
};

DebuggerLib.isExecutableLine = function(context, location)
{
    var threadClient = this.getThreadActor(context.browser);

    // Use 'innermost' property so, the result is (almost) always just one script object
    // and we can save time in the loop below. See: https://wiki.mozilla.org/Debugger
    var query = {
        url: location.url,
        line: location.line,
        innermost: true,
    };

    var scripts = threadClient.dbg.findScripts(query);
    for (var i = 0; i < scripts.length; i++)
    {
        var script = scripts[i];
        var offsets = script.getLineOffsets(location.line);
        if (offsets.length > 0)
            return true;
    }

    return false;
};

// ********************************************************************************************* //
// Scopes (+ this + frame result value)

/**
 * If the debugger is stopped and has reached a return / yield statement or an exception,
 * return the Frame Result type and value of it. Otherwise, return null.
 *
 * The object returned has this form: {type: <type>, value: <frame result value>}
 *
 * If the debugger has reached a return statement, <type> is "return".
 * If an exception has been raised, <type> is "exception".
 *
 * @param {object} context
 *
 * @return {object}
 */
DebuggerLib.getFrameResultObject = function(context)
{
    if (!context.stopped || !context.currentPacket || !context.currentPacket.why)
        return null;

    var frameFinished = context.currentPacket.why.frameFinished;
    if (!frameFinished)
        return null;

    var type = null;
    var value = null;

    if ("return" in frameFinished)
    {
        type = "return";
        value = frameFinished.return;
    }
    else if ("throw" in frameFinished)
    {
        type = "exception";
        value = frameFinished.throw;
    }

    return {
        type: type,
        value: value,
    };
};

// ********************************************************************************************* //
// Debugger

DebuggerLib.breakNow = function(context)
{
    // getInactiveDebuggeeGlobal uses the current global (i.e. stopped frame, current
    // iframe or top level window associated with the context object).
    // There can be cases (e.g. BON XHR) where the current window is an iframe, but
    // the event the debugger breaks on - comes from top level window (or vice versa).
    // For now there are not known problems, but we might want to use the second
    // argument of the getInactiveDebuggeeGlobal() and pass explicit global object.
    var dbgGlobal = this.getInactiveDebuggeeGlobal(context);
    return dbgGlobal.evalInGlobal("debugger");
};

DebuggerLib.makeDebugger = function()
{
    return new global.Debugger();
};

DebuggerLib.makeDebuggerForContext = function(context)
{
    try
    {
        var addNewDebuggee = function(dbg, win, dbgGlobal)
        {
            // We are only interested in iframes...
            var global = DebuggerLib.unwrapDebuggeeValue(dbgGlobal);
            if (!(global instanceof Window))
                return;

            // ... and only iframes coming from the same top level window.
            var root = Wrapper.unwrapObject(global.top);
            if (root == win)
                dbg.addDebuggee(global);
        };

        var dbg = DebuggerLib.makeDebugger();

        var win = Wrapper.unwrapObject(context.window);
        dbg.addDebuggee(win);

        // Append the top level window and all iframes as debuggees (to debug any JS
        // script on the page).
        for (var i=0; i<context.windows.length; i++)
            dbg.addDebuggee(context.windows[i]);

        // Register 'onNewGlobalObject' hook to append dynamically created iframes
        // into the debugger as debuggees.
        dbg.onNewGlobalObject = function(global)
        {
            // xxxHonza: use timeout to avoid crash, see:
            // https://bugzilla.mozilla.org/show_bug.cgi?id=885301
            setTimeout(addNewDebuggee.bind(this, dbg, win, global));
        };

        if (!context.debuggers)
            context.debuggers = [];
        context.debuggers.push(dbg);

        return dbg;
    }
    catch (err)
    {
        TraceError.sysout("DebuggerLib.makeDebuggerForContext; EXCEPTION " + err, err);
    }
};

DebuggerLib.destroyDebuggerForContext = function(context, dbg)
{
    dbg.enabled = false;
    var ind = context.debuggers.indexOf(dbg);
    if (ind !== -1)
        context.debuggers.splice(ind, 1);
};

// ********************************************************************************************* //
// Local helpers

/**
 * Gets or creates the Inactive Debugger instance for the given context (singleton).
 *
 * @param context {*}
 *
 * @return {Debugger} The Debugger instance
 */
var getInactiveDebuggerForContext = function(context)
{
    if (context.inactiveDebugger)
        return context.inactiveDebugger;

    var dbg = DebuggerLib.makeDebugger();
    dbg.enabled = false;
    context.inactiveDebugger = dbg;
    return dbg;
};

// ********************************************************************************************* //
// Registration

// Expose for FBTest
Firebug.DebuggerLib = DebuggerLib;

return DebuggerLib;

// ********************************************************************************************* //
});

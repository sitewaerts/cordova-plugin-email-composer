// noinspection ES6ConvertVarToLetConst

/*
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */


var exec = cordova.require('cordova/exec'),
    ua = navigator.userAgent.toLowerCase(),
    isWindows = !!window.Windows,
    isAndroid = !window.Windows && ua.indexOf('android') > -1,
    mailto = 'mailto:';

/**
 * public plugin api
 */
var plugin = {};

/**
 * List of all registered mail app aliases.
 * @readonly
 * @type {Record<string, string>}
 */
plugin.aliases = {
    gmail: isAndroid ? 'com.google.android.gm' : 'googlegmail://co',
    outlook: isAndroid ? 'com.microsoft.office.outlook' : 'ms-outlook://compose',
    hub: isAndroid ? 'com.blackberry.hub' : undefined
};

/**
 * List of possible permissions to request.
 * @readonly
 * @type {Record<string, number>}
 */
plugin.permission = {
    READ_EXTERNAL_STORAGE: 1,
    READ_ACCOUNTS: 2
};

/**
 * List of all available options with their default value.
 *
 * @return {*}
 */
plugin.getDefaults = function ()
{
    return {
        app: mailto,
        from: '',
        subject: '',
        body: '',
        to: [],
        cc: [],
        bcc: [],
        attachments: [],
        isHtml: false,
        chooserHeader: 'Open with'
    };
};

/**
 * Informs if the app has the given permission.
 *
 * @param {number} permission The permission to check.
 * @param {(hasPermission:boolean)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.hasPermission = function (permission, callback, scope)
{
    var fn = createCallbackFn(callback, scope);

    if (!isAndroid)
    {
        if (fn) fn(true);
        return;
    }

    function onError(error)
    {
        console.error("email_composer: cannot check permission", error);
        // TODO pass error to error callback
        if(fn)
            fn(false);
    }

    exec(fn, onError, 'EmailComposer', 'check', [permission]);
};

/**
 * Request given permission if not already granted.
 *
 * @param {number} permission The permission to grant.
 * @param {(hasPermission:boolean)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.requestPermission = function (permission, callback, scope)
{
    var fn = createCallbackFn(callback, scope);

    if (!isAndroid)
    {
        if (fn) fn(true);
        return;
    }

    function onError(error)
    {
        console.error("email_composer: cannot request permission", error);
        // TODO pass error to error callback
        if(fn)
            fn(false);
    }

    exec(fn, onError, 'EmailComposer', 'request', [permission]);
};

/**
 * Tries to find out if the device has an email account configured.
 *
 * @param {(hasAccount:boolean)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.hasAccount = function (callback, scope)
{
    var fn = createCallbackFn(callback, scope);

    function onError(error)
    {
        console.error("email_composer: cannot check account", error);
        // TODO pass error to error callback
        if(fn)
            fn(false);
    }

    exec(fn, onError, 'EmailComposer', 'account', []);
};

/**
 * Tries to find out if the device has an email client installed.
 *
 * @param {string} app An optional app id or uri scheme. Defaults to mailto.
 * @param {(hasClient:boolean)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.hasClient = function (app, callback, scope)
{

    if (typeof callback != 'function')
    {
        scope = null;
        // noinspection JSValidateTypes
        callback = app;
        app = mailto;
    }

    var fn = createCallbackFn(callback, scope);
    app = app || mailto;

    if (plugin.aliases.hasOwnProperty(app))
    {
        app = plugin.aliases[app];
    }

    function onError(error)
    {
        console.error("email_composer: cannot check client", error);
        // TODO pass error to error callback
        if(fn)
            fn(false);
    }


    exec(fn, onError, 'EmailComposer', 'client', [app]);
};

/**
 * List of package IDs for all available email clients (Android only).
 *
 * @param {(clients:Array<string>|null)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.getClients = function (callback, scope)
{
    var fn = createCallbackFn(callback, scope);

    if (!isAndroid)
    {
        if (fn) fn(null);
        return;
    }

    function onError(error)
    {
        console.error("email_composer: cannot get clients", error);
        // TODO pass error to error callback
        if(fn)
            fn(null);
    }

    exec(fn, onError, 'EmailComposer', 'clients', []);
};

/**
 * Displays the email composer pre-filled with data.
 *
 * @param {*} options  The email properties like the body,...
 * @param {(error:any)=>void} callback The callback function.
 * @param {*} scope The scope of the callback.
 *
 * @void
 */
plugin.open = function (options, callback, scope)
{

    if (typeof options == 'function')
    {
        scope = callback;
        callback = options;
        options = {};
    }

    var fn = createCallbackFn(callback, scope);
    options = mergeWithDefaults(options || {});

    if (!isAndroid && options.app !== mailto && fn)
    {
        registerCallbackForScheme(fn);
    }

    function onError(error)
    {
        console.error("email_composer: cannot open", error);
        if(fn)
            fn(error);
    }

    exec(fn, onError, 'EmailComposer', 'open', [options]);
};

/**
 * Alias for `open()`.
 */
plugin.openDraft = plugin.open.bind(plugin);

/**
 * Adds a new mail app alias.
 *
 * @param {string} alias The alias name.
 * @param {string} packageName The package name.
 *
 * @void
 */
plugin.addAlias = function (alias, packageName)
{
    plugin.aliases[alias] = packageName;
};


/**
 * @private
 *
 * Merge settings with default values.
 *
 * @param {*} options The custom options
 *
 * @return {*} Default values merged with custom values.
 */
function mergeWithDefaults(options)
{
    var defaults = plugin.getDefaults();

    if (!options.hasOwnProperty('isHtml'))
    {
        options.isHtml = defaults.isHtml;
    }

    if (options.hasOwnProperty('app'))
    {
        options.app = plugin.aliases[options.app] || options.app;
    }

    if (Array.isArray(options.body))
    {
        options.body = options.body.join("\n");
    }

    options.app = String(options.app || defaults.app);
    options.from = String(options.from || defaults.from);
    options.subject = String(options.subject || defaults.subject);
    options.body = String(options.body || defaults.body);
    options.chooserHeader = String(options.chooserHeader || defaults.chooserHeader);
    options.to = options.to || defaults.to;
    options.cc = options.cc || defaults.cc;
    options.bcc = options.bcc || defaults.bcc;
    options.attachments = options.attachments || defaults.attachments;
    options.isHtml = !!options.isHtml;

    if (!Array.isArray(options.to))
    {
        options.to = [options.to];
    }

    if (!Array.isArray(options.cc))
    {
        options.cc = [options.cc];
    }

    if (!Array.isArray(options.bcc))
    {
        options.bcc = [options.bcc];
    }

    if (!Array.isArray(options.attachments))
    {
        options.attachments = [options.attachments];
    }

    return options;
}

/**
 * @private
 *
 * Creates a callback, which will be executed
 * within a specific scope.
 *
 * @param {(...args: any[])=>void | null} callback The callback function.
 * @param {* | null} [scope] The scope for the function.
 *
 * @return {(...args: any[])=>void | null} The new callback function
 */
function createCallbackFn(callback, scope)
{
    if (typeof callback !== 'function')
        return null;
    return callback.bind(scope || this);
}

/**
 * @private
 *
 * Register an EventListener on resume-Event to
 * execute callback after open a draft.
 * @param {()=>void} fn
 * @void
 */
registerCallbackForScheme = function (fn)
{
    if (typeof callback !== 'function')
        return;

    function callback()
    {
        document.removeEventListener('resume', callback);
        try
        {
            fn();
        } catch (e)
        {
            console.error("email_composer: cannot execute callback", e);
        }
    }

    document.addEventListener('resume', callback, false);
};

module.exports = plugin;

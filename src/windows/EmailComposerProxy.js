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

var util = cordova.require('cordova-plugin-email-composer.EmailComposerUtil');

var WinLauncher = Windows.System.Launcher;
var WinMail = Windows.ApplicationModel.Email;

var proxy = {};

/*
 Access to Windows.ApplicationModel.Email may be restricted and/or require additional capabilities.
 see https://docs.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations
 Native code may throw unhandled exceptions when accessing these apis and those may crash the app.
 This is why we cannot use WinMail per default in this plugin anymore
 */


/**
 * Tries to find out if the device has an email account configured.
 *
 * @param {(account:boolean|null)=>void} success Success callback
 *
 * @void
 */
proxy.account = function (success) {
    success(null);
};

/**
 * Tries to find out if the device has an installed email client.
 *
 * @param {(client:boolean|null)=>void} success Success callback
 * @param {(error:any)=>void} error Error callback
 * @param {Array<any>} args Interface arguments
 *
 * @void
 */
proxy.client = function (success, error, args) {
    var app = args[0]
    success(app === 'mailto:'
    || app === 'mailto'
    || app === 'emlFile'
    || (app === 'windowsEmail' && isWinMailAvailable())
        ? true : null);
};

/**
 * Displays the email composer pre-filled with data.
 *
 * @param {()=>void} success Success callback
 * @param {(error:any)=>void} error Error callback
 * @param {Array<any>} args Interface arguments
 *
 * @void
 */
proxy.open = function (success, error, args) {
    var props = args[0];

    var onError = function(e){
                if(console)
                    console.error("cannot open email composer", e);
                if(error)
                    error(e);
    };

    if (useWinMail(props)) {
            getDraftWithProperties(props)
                .then(WinMail.EmailManager.showComposeNewEmailAsync, function (e) {
                    // could not compose
                    if(props.isHtml)
                    {
                        // possibly compose failed because this app is compiled for win8.1 but running on win10
                        //  --> in this special case WinMail is available, but the EmailMessage.setBodyStream api is not fully supported
                        // retry via eml file
                        if(console)
                            console.warn("WinMail.EmailManager.showComposeNewEmailAsync failed, trying launcher now.");
                        sendViaLauncher(true);
                    }
                    else {
                        onError(e);
                    }
                })
                .done(success, onError);
    } else{
        sendViaLauncher(false);
    }

    /**
     *
     * @param {boolean} forceEmlFile
     */
    function sendViaLauncher(forceEmlFile)
    {
        /**
         * @param {LaunchInfoWindowsFile} launchInfo
         */
        function launchFile(launchInfo)
        {
            WinLauncher.launchFileAsync(
                    launchInfo.file, launchInfo.options).done(
                    function (launchSuccess)
                    {
                        launchInfo.close();
                        if (launchSuccess)
                            success();
                        else
                            onError(new Error("cannot launch file " + launchInfo.file));

                    }, function (e)
                    {
                        try
                        {
                            launchInfo.close();
                        }
                        catch (er)
                        {
                            e.followUp = er;
                        }
                        onError(e);
                    });
        }

        /**
         * @param {LaunchInfoWindowsUri} launchInfo
         */
        function launchUri(launchInfo)
        {
            WinLauncher.launchUriAsync(
                    launchInfo.uri, launchInfo.options).done(
                    function (launchSuccess)
                    {
                        launchInfo.close();
                        if (launchSuccess)
                            success();
                        else
                            onError(new Error("cannot launch uri " + launchInfo.uri));
                    }, function (e)
                    {
                        try
                        {
                            launchInfo.close();
                        }
                        catch (er)
                        {
                            e.followUp = er;
                        }
                        onError(e);
                    });

        }

        if (supportsEMLFile(props, forceEmlFile))
            getEMLFile(props, launchFile);
        else
            getMailToUri(props, launchUri);
    }
};

/**
 * @typedef {LaunchInfo} LaunchInfoWindows
 * @property {Windows.System.LauncherOptions} options
 */

/**
 * @typedef {LaunchInfoWindows} LaunchInfoWindowsFile
 * @property {Windows.Storage.IStorageFile} file
 */

/**
 * @typedef {LaunchInfoWindows} LaunchInfoWindowsUri
 * @property {Windows.Foundation.Uri} uri
 */

/**
 * @param {*} props
 * @return {boolean}
 */
function useWinMail(props){
    return isWinMailAvailable() && props.app === 'windowsEmail';
}

/**
 * @return {boolean}
 */
function isWinMailAvailable(){
    // TODO: check if capabilities required for Windows.ApplicationModel.Email are set
    return !!WinMail;
}

/**
 * The Email with the containing properties.
 *
 * @param {*} props Properties like subject.
 *
 * @return {WinJS.Promise<Windows.ApplicationModel.Email.EmailMessage>}
 */
function getDraftWithProperties (props) {
    return new WinJS.Promise(function (complete, error) {
        var mail = new WinMail.EmailMessage();

        // From sender
        setSendingEmailAddress(props.from, mail);
        // Subject
        setSubject(props.subject, mail);
        // To recipients
        setRecipients(props.to, mail.to);
        // CC recipients
        setRecipients(props.cc, mail.cc);
        // BCC recipients
        setRecipients(props.bcc, mail.bcc);

        // body
        setBody(props.body, props.isHtml, mail)
            .then(function () {
                // attachments
                return setAttachments(props.attachments, mail)
            }, error)
            .done(function () {
                complete(mail);
            }, error);
    });
}

/**
 * Setter for the subject.
 *
 * @param {string} subject
 * @param {Windows.ApplicationModel.Email.EmailMessage} draft
 * @void
 */
function setSubject(subject, draft) {
    draft.subject = subject;
}

/**
 * Setter for the body.
 *
 * @param {string} body The email body.
 * @param {boolean} isHTML Indicates the encoding (HTML or plain text)
 * @param {Windows.ApplicationModel.Email.EmailMessage} draft
 *
 * @return {WinJS.Promise<Windows.ApplicationModel.Email.EmailMessage>}
 */
function setBody(body, isHTML, draft) {
    if(!isHTML)
    {
        draft.body = body;
        return WinJS.Promise.as(draft);
    }


    return new WinJS.Promise(function (complete, error)
    {
        try
        {
            var stream = new Windows.Storage.Streams.InMemoryRandomAccessStream();
            var writer = new Windows.Storage.Streams.DataWriter(stream);
            writer.unicodeEncoding = Windows.Storage.Streams.UnicodeEncoding.utf8;
            writer.byteOrder = Windows.Storage.Streams.ByteOrder.littleEndian;

            writer.writeInt32(writer.measureString(body));
            writer.writeString(body);

            writer.storeAsync().then(function ()
            {
                // For the in-memory stream implementation we are using, the flushAsync call
                // is superfluous, but other types of streams may require it.
                return writer.flushAsync();
            }).then(function ()
            {
                writer.detachStream();
                stream.seek(0);
                writer.close();
                // will fail if app is compiled for win8.1 (WinRTError: Schnittstelle nicht unterstützt)
                draft.setBodyStream(Windows.ApplicationModel.Email.EmailMessageBodyKind.html, stream);
                return draft;
            }).done(complete, function(e){
                if (console)
                    console.warn("cannot set html body stream", e);
                error(e);
            });
        }
        catch (e)
        {
            if (console)
                console.warn("cannot set html body stream", e);
            error(e);
        }

    });

}

/**
 * Setter for the sending email address.
 *
 * @param {string} from The sending email address.
 * @param {Windows.ApplicationModel.Email.EmailMessage} draft
 *
 * @void
 */
function setSendingEmailAddress(from, draft) {
    if(from && from.length > 0)
        draft.sender = new WinMail.EmailRecipient(from);
}

/**
 * Setter for the recipients.
 *
 * @param {Array<string>} recipients List of emails
 * @param {Windows.Foundation.Collections.IVector<Windows.ApplicationModel.Email.EmailRecipient>} draft
 *
 * @void
 */
function setRecipients(recipients, draft) {
    recipients.forEach(function (address) {
        draft.push(new WinMail.EmailRecipient(address));
    });
}

/**
 * Setter for the attachments.
 *
 * @param {Array<string>} attachments List of uris
 * @param {Windows.ApplicationModel.Email.EmailMessage} draft List of uris
 * @param {WinJS.Promise<Windows.ApplicationModel.Email.EmailMessage>} draft
 *
 * @void
 */
function setAttachments(attachments, draft) {
    var promises = [];

    return new WinJS.Promise(function (complete) {
        attachments.forEach(function (path) {
            promises.push(getUriForPath(path));
        });

        WinJS.Promise.thenEach(promises, function (uri) {
            draft.attachments.push(
                new WinMail.EmailAttachment(
                    uri.path.split('/').reverse()[0],
                    Windows.Storage.Streams.RandomAccessStreamReference.createFromUri(uri)
                )
            );
        }).done(complete);
    });
}


/**
 * create mailto uri and corresponding Windows.System.LauncherOptions
 * @param {*} props Properties like subject.
 * @param {(launchInfo: LaunchInfoWindowsUri)=>void} callback
 * @void
 */
function getMailToUri(props, callback){
    var mailto = util.getMailToUri(props, false);
    var options = new Windows.System.LauncherOptions();
    callback({
        options: options,
        close: function(){
            mailto.close();
        },
        uri: new Windows.Foundation.Uri(mailto.uri)
    });
}

/**
 * opening email draft from eml file ist not supported by some email apps
 * e.g. outlook supports it, but the windows mail app doesn't
 * to use the eml feature the property emlFile = true must be specified
 *
 * advantage of the eml file: body may contain html content,
 * which is not supported by mailto links
 *
 * @param {*} props
 * @param {boolean} [force]
 * @return {boolean}
 */
function supportsEMLFile(props, force) {
    // if(!(WinJS && WinJS.Application && WinJS.Application.temp))
    //     return false;
    if(!(Windows && Windows.Storage && Windows.Storage.ApplicationData && Windows.Storage.ApplicationData.current && Windows.Storage.ApplicationData.current.temporaryFolder))
        return false;
    if(force)
        return true;
    if(util.isTrue(props['emlFile']))
        return true; // backwards compatibility
    return props.app === 'emlFile';
}

/**
 * create temp eml file and corresponding Windows.System.LauncherOptions
 * @param {*} props
 * @param {(launchInfo: LaunchInfoWindowsFile)=>void} callback
 */
function getEMLFile(props, callback) {

    var eml = util.getEMLContent(props);
    var options = new Windows.System.LauncherOptions();
    //options.contentType = eml.contentType;
    //options.displayApplicationPicker = true;

    Windows.Storage.ApplicationData.current.temporaryFolder.createFileAsync(
        "emailcomposer.eml",
        Windows.Storage.CreationCollisionOption.replaceExisting).done(
        function (tempFile) {
            Windows.Storage.FileIO.writeTextAsync(
                tempFile,
                eml.text,
                Windows.Storage.Streams.UnicodeEncoding.utf8).done(
                function(){
                    callback({
                        file : tempFile,
                        options : options,
                        close : function(){
                            eml.close();
                            // wait until app has started and read the file
                            setTimeout(function () {
                                tempFile.deleteAsync();
                            }, 60000);
                        }
                    });

                }
            );
        }
    );
}

/**
 * The URI for an attachment path.
 *
 * @param {string} path The path to the attachment.
 *
 * @return {WinJS.Promise<Windows.Foundation.Uri>}
 */
function getUriForPath(path) {
    return new WinJS.Promise(function (complete) {
        if (path.match(/^res:/)) {
            complete(getUriForResourcePath(path));
        } else if (path.match(/^file:\/{3}/)) {
            complete(getUriForAbsolutePath(path));
        } else if (path.match(/^file:/)) {
            complete(getUriForAssetPath(path));
        } else if (path.match(/^app:/)) {
            complete(getUriForAppInternalPath(path));
        } else if (path.match(/^base64:/)) {
            getUriFromBase64(path).then(complete);
        } else {
            complete(new Windows.Foundation.Uri(path));
        }
    });
}

/**
 * The URI for a file.
 *
 * @param {string} path Absolute path to the attachment.
 *
 * @return {Windows.Foundation.Uri}
 */
function getUriForAbsolutePath(path) {
    return new Windows.Foundation.Uri(path);
}

/**
 * The URI for an asset.
 *
 * @param {string} path Asset path to the attachment.
 *
 * @return {Windows.Foundation.Uri}
 */
function getUriForAssetPath(path) {
    var resPath = path.replace('file:/', '/www');

    return getUriForPathUtil(resPath);
}

/**
 * The URI for a resource.
 *
 * @param {string} path Relative path to the attachment.
 *
 * @return {Windows.Foundation.Uri}
 */
function getUriForResourcePath(path) {
    var resPath = path.replace('res:/', '/images');

    return getUriForPathUtil(resPath);
}

/**
 * The URI for an app internal file.
 *
 * @param {string} path Relative path to the app root dir.
 *
 * @return {Windows.Foundation.Uri}
 */
function getUriForAppInternalPath(path) {
    var resPath = path.replace('app:/', '/');

    return getUriForPathUtil(resPath);
}

/**
 * The URI for a path.
 *
 * @param {string} resPath Relative path to the attachment.
 *
 * @return {Windows.Foundation.Uri}
 */
function getUriForPathUtil(resPath) {
    var rawUri = 'ms-appx:' + '//' + resPath;

    return new Windows.Foundation.Uri(rawUri);
}

/**
 * The URI for a base64 encoded content.
 *
 * @param {string} content Base64 encoded content.
 *
 * @return {WinJS.Promise<Windows.Foundation.Uri>}
 */
function getUriFromBase64(content) {
    return new WinJS.Promise(function (complete) {
        var match  = content.match(/^base64:([^\/]+)\/\/(.*)/),
            base64 = match[2],
            name   = match[1],
            buffer = Windows.Security.Cryptography.CryptographicBuffer.decodeFromBase64String(base64),
            rwplus = Windows.Storage.CreationCollisionOption.openIfExists,
            folder = Windows.Storage.ApplicationData.current.temporaryFolder,
            uri    = new Windows.Foundation.Uri('ms-appdata:///temp/' + name);

        folder.createFileAsync(name, rwplus).done(function (file) {
            Windows.Storage.FileIO.writeBufferAsync(file, buffer).then(function () {
                complete(uri);
            });
        });
    });
}


cordova.require('cordova/exec/proxy').add('EmailComposer', proxy);

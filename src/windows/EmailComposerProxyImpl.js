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
/* globals Windows: true */
var proxy   = require('cordova-plugin-email-composer.EmailComposerProxy'),
    impl    = proxy.impl = {},
    WinMail = Windows.ApplicationModel.Email;


/**
 * The Email with the containing properties.
 *
 * @param {Object} props Properties like subject.
 *
 * @return {Windows.ApplicationModel.Email.EmailMessage}
 */
impl.getDraftWithProperties = function (props) {
    var me = this;

    return new WinJS.Promise(function (complete, error) {
        var mail = new WinMail.EmailMessage();

        // From sender
        me.setSendingEmailAddress(props.from, mail);
        // Subject
        me.setSubject(props.subject, mail);
        // To recipients
        me.setRecipients(props.to, mail.to);
        // CC recipients
        me.setRecipients(props.cc, mail.cc);
        // BCC recipients
        me.setRecipients(props.bcc, mail.bcc);

        // body
        me.setBody(props.body, props.isHtml, mail)
        .then(function () {
            // attachments
            return me.setAttachments(props.attachments, mail)
        }, error)
        .done(function () {
            complete(mail);
        }, error);
    });
};

/**
 * Construct a mailto: string based on the provided properties.
 *
 * @param {Object} props Properties like subject.
 *
 * @return {Windows.Foundation.Uri}
 */
impl.getMailTo = function (props){
    var mailto = proxy.commonUtil.getMailToUri(props, false);
    return new Windows.Foundation.Uri(mailto.uri);
};

/**
    * opening email draft from eml file ist not supported by some email apps
    * e.g. outlook supports it, but the windows mail app doesn't
    * to use the the eml feature the property emlFile = true must be specified
    *
    * advantage of the eml file: body may contain html content,
    * which is not supported by mailto links
    *
    * @return {boolean}
    */
   impl.supportsEMLFile = function (props) {
       if(!(WinJS && WinJS.Application && WinJS.Application.temp))
           return false;
       if(!props.emlFile)
           return false;

       return props.emlFile === true || props.emlFile === 'true';
};

   /**
    * create temp eml file and corresponding Windows.System.LauncherOptions
    * @param {*} props
    * @param {function({ file : StorageFile, options : Windows.System.LauncherOptions, close : function})} callback
    */
   impl.getEMLFile = function (props, callback) {

       var eml = proxy.commonUtil.getEMLContent(props);
       var options = new Windows.System.LauncherOptions();
       //options.contentType = eml.contentType;
       //options.displayApplicationPicker = true;

       WinJS.Application.temp.folder.createFileAsync(
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
   };

/**
 * Setter for the subject.
 *
 * @param {string}             subject
 * @param {Email.EmailMessage} draft
 * @void
 */
impl.setSubject = function (subject, draft) {
    draft.subject = subject;
};

/**
 * Setter for the body.
 *
 * @param {string}  body   The email body.
 * @param {boolean} isHTML Indicates the encoding (HTML or plain text)
 * @param {Email.EmailMessage} draft
 *
 * @return {WinJS.Promise}
 */
impl.setBody = function (body, isHTML, draft) {
    if(!isHTML)
    {
        draft.body = body;
        return WinJS.Promise.as(draft);
    }


    return new WinJS.Promise(function (complete, error)
    {
        try
        {
            var writer = Windows.Storage.Streams.DataWriter(
                    new Windows.Storage.Streams.InMemoryRandomAccessStream());
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
                var stream = writer.detachStream();
                stream.seek(0);
                writer.close();
                // will fail if app is compiled for win8.1 (WinRTError: Schnittstelle nicht unterstützt)
                draft.setBodyStream(
                        Windows.ApplicationModel.Email.EmailMessageBodyKind.html,
                        stream);
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

};

/**
 * Setter for the sending email address.
 *
 * @param [ String ]             from  The sending email address.
 * @param [ Email.EmailMessage ] draft
 *
 * @return [ Void ]
 */
impl.setSendingEmailAddress = function (from, draft) {
    if(from && from.length > 0)
    draft.sender = new WinMail.EmailRecipient(from);
};

/**
 * Setter for the recipients.
 *
 * @param [ Array<String> ]      recipients List of emails
 * @param [ Email.EmailMessage ] draft
 *
 * @return [ Void ]
 */
impl.setRecipients = function (recipients, draft) {
    recipients.forEach(function (address) {
        draft.push(new WinMail.EmailRecipient(address));
    });
};

/**
 * Setter for the attachments.
 *
 * @param [ Array<String> ]      attachments List of uris
 * @param [ Email.EmailMessage ] draft
 *
 * @return [ Void ]
 */
impl.setAttachments = function (attachments, draft) {
    var promises = [], me = this;

    return new WinJS.Promise(function (complete) {
        attachments.forEach(function (path) {
            promises.push(me.getUriForPath(path));
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
};

/**
 * The URI for an attachment path.
 *
 * @param [ String ] path The path to the attachment.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForPath = function (path) {
    var me = this;

    return new WinJS.Promise(function (complete) {
        if (path.match(/^res:/)) {
            complete(me.getUriForResourcePath(path));
        } else if (path.match(/^file:\/{3}/)) {
            complete(me.getUriForAbsolutePath(path));
        } else if (path.match(/^file:/)) {
            complete(me.getUriForAssetPath(path));
        } else if (path.match(/^app:/)) {
            complete(me.getUriForAppInternalPath(path));
        } else if (path.match(/^base64:/)) {
            me.getUriFromBase64(path).then(complete);
        } else {
            complete(new Windows.Foundation.Uri(path));
        }
    });
};

/**
 * The URI for a file.
 *
 * @param [ String ] path Absolute path to the attachment.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForAbsolutePath = function (path) {
    return new Windows.Foundation.Uri(path);
};

/**
 * The URI for an asset.
 *
 * @param [ String ] path Asset path to the attachment.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForAssetPath = function (path) {
    var resPath = path.replace('file:/', '/www');

    return this.getUriForPathUtil(resPath);
};

/**
 * The URI for a resource.
 *
 * @param [ String ] path Relative path to the attachment.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForResourcePath = function (path) {
    var resPath = path.replace('res:/', '/images');

    return this.getUriForPathUtil(resPath);
};

/**
 * The URI for an app internal file.
 *
 * @param [ String ] path Relative path to the app root dir.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForAppInternalPath = function (path) {
    var resPath = path.replace('app:/', '/');

    return this.getUriForPathUtil(resPath);
};

/**
 * The URI for a path.
 *
 * @param [ String ] path Relative path to the attachment.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriForPathUtil = function (resPath) {
    var rawUri = 'ms-appx:' + '//' + resPath;

    return new Windows.Foundation.Uri(rawUri);
};

/**
 * The URI for a base64 encoded content.
 *
 * @param [ String ] content Base64 encoded content.
 *
 * @return [ Windows.Foundation.Uri ]
 */
impl.getUriFromBase64 = function (content) {
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
};

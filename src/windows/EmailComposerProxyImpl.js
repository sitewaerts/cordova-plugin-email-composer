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
    impl    = proxy.impl = {};

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

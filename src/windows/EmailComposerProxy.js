/* globals Windows: true */

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

var WinLauncher = Windows.System.Launcher,
    WinMail     = Windows.ApplicationModel.Email;

/**
 * Tries to find out if the device has an configured email account.
 *
 * @param [ Function ] success Success callback
 * @param [ Function ] error   Error callback
 * @param [ Array ]    args    Interface arguments
 *
 * @return [ Void ]
 */
exports.account = function (success, error, args) {
    success(null);
};

/**
 * Tries to find out if the device has an installed email client.
 *
 * @param [ Function ] success Success callback
 * @param [ Function ] error   Error callback
 * @param [ Array ]    args    Interface arguments
 *
 * @return [ Void ]
 */
exports.client = function (success, error, args) {
    success(args[0] === 'mailto:' ? true : null);
};

/**
 * Displays the email composer pre-filled with data.
 *
 * @param {function} success Success callback
 * @param {function} error   Error callback
 * @param {Array}    args    Interface arguments
 *
 * @void
 */
exports.open = function (success, error, args) {
    var props = args[0],
        impl  = exports.impl;

    var onError = function(e){
                if(console)
                    console.error("cannot open email composer", e);
                if(error)
                    error(e);
    };

    /**
     * Access to Windows.ApplicationModel.Email may be restricted and/or require additional capabilities
     * see https://docs.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations
     *
     */

    // if (WinMail) {
    //         impl.getDraftWithProperties(props)
    //             .then(WinMail.EmailManager.showComposeNewEmailAsync, function (e) {
    //                 // could not compose
    //                 if(props.isHtml)
    //                 {
    //                     // may be compose failed because this app is compiled for win8.1 but running on win10
    //                     //  --> in this special case WinMail is available, but the EmailMessage.setBodyStream api is not fully supported
    //                     // retry via eml file
    //                     if(console)
    //                         console.warn("WinMail.EmailManager.showComposeNewEmailAsync failed, trying launcher now.");
    //                     sendViaLauncher();
    //                 }
    //                 else {
    //                     onError(e);
    //                 }
    //             })
    //             .done(success, onError);
    // } else{
    //     sendViaLauncher();
    // }
    sendViaLauncher();

    function sendViaLauncher()
    {
        function launchFile(launchInfo)
        {
            WinLauncher.launchFileAsync(
                    launchInfo.file, launchInfo.options).done(
                    function (launchSuccess)
                    {
                        launchInfo.close();
                        if (launchSuccess)
                        {
                            success();
                        }
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

        function launchUri(launchInfo)
        {
            WinLauncher.launchUriAsync(
                    launchInfo.uri, launchInfo.options).done(
                    function (launchSuccess)
                    {
                        launchInfo.close();
                        if (launchSuccess)
                        {
                            success();
                        }
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

        if (impl.supportsEMLFile(props))
            impl.getEMLFile(props, launchFile);
        else
            impl.getMailToUri(props, launchUri);
    }
};

require('cordova/exec/proxy').add('EmailComposer', exports);

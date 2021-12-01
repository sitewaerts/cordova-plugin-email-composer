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

var proxy = {};

/**
 * Tries to find out if the device has an configured email account.
 *
 * @param {function} success Success callback
 * @param {function} error Error callback
 * @param {Array} args Interface arguments
 *
 * @void
 */
proxy.account = function (success, error, args) {
    var app = args[0]
    success(app === 'mailto:' || app === 'mailto' ? true : null);

};

/**
 * Tries to find out if the device has an installed email client.
 *
 * @param {function} success Success callback
 *
 * @void
 */
proxy.client = function (success) {
    success(null);
};

/**
 * Displays the email composer pre-filled with data.
 *
 * @param {function} success Success callback
 * @param {function} error Error callback
 * @param {Array} args Interface arguments
 *
 * @void
 */
proxy.open = function (success, error, args) {
    var props   = args[0];

    // TODO: emlFile support incl. attachments

    var mailTo = util.getMailToUri(props, true);
    window.location.href = mailTo.uri;

    success();
};

cordova.require('cordova/exec/proxy').add('EmailComposer', proxy);

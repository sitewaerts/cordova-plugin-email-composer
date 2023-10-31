/*
 *
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */

const path = require('path');
const fs = require('fs-extra');

const util = require('../EmailComposerUtil');

/**
 *
 * @param callbackContext
 * @returns {any}
 */
function getFilePluginUtil(callbackContext)
{
    return callbackContext.getCordovaService('File').util;
}

/**
 * get absolute file path for given url (cdvfile://, efs://)
 * @param {string} url
 * @param callbackContext
 * @returns {string | null}
 */
function urlToFilePath(url, callbackContext)
{
    return getFilePluginUtil(callbackContext).urlToFilePath(url);
}

/**
 * @param {string} uri
 * @param callbackContext
 * @returns {Promise<EntryInfo>}
 */
function resolveLocalFileSystemURI(uri, callbackContext)
{
    return getFilePluginUtil(callbackContext).resolveLocalFileSystemURI(uri);
}


function isNotFoundError(error)
{
    return !!(error && error.code === 'ENOENT');
}


const emailComposerPlugin = {

    /**
     * @param {string | null} [app]
     * @param {CallbackContext} callbackContext
     * @void
     */
  account: ([app], callbackContext)=>{
        callbackContext.success(app === 'mailto:' || app === 'mailto' ? true : null)
  },
    /**
     * @param {CallbackContext} callbackContext
     * @void
     */
  client: ([], callbackContext)=>{
        callbackContext.success()
  },
    /**
     * @param {*} [props]
     * @param {CallbackContext} callbackContext
     * @void
     */
  open: ([props], callbackContext)=>{
        // TODO: emlFile support incl. attachments
        const mailTo = util.getMailToUri(props, true);
        window.location.href = mailTo.uri;
        callbackContext.success();
  }
}

/**
 * cordova electron plugin api
 * @param {string} action
 * @param {Array<any>} args
 * @param {CallbackContext} callbackContext
 * @returns {boolean} indicating if action is available in plugin
 */
const plugin = function (action, args, callbackContext)
{
    if (!emailComposerPlugin[action])
        return false;
    try
    {
        emailComposerPlugin[action](args, callbackContext)
    } catch (e)
    {
        console.error(action + ' failed', e);
        callbackContext.error({message: action + ' failed', cause: e});
    }
    return true;
}

// backwards compatibility: attach api methods for direct access from old cordova-electron platform impl
Object.keys(emailComposerPlugin).forEach((apiMethod) =>
{
    plugin[apiMethod] = (args) =>
    {
        return Promise.resolve((resolve, reject) =>
        {
            emailComposerPlugin[apiMethod](args, {
                progress: (data) =>
                {
                    console.warn("cordova-plugin-email-composer: ignoring progress event as not supported in old plugin API", data);
                },
                success: (data) =>
                {
                    resolve(data)
                },
                error: (data) =>
                {
                    reject(data)
                }
            });
        });
    }
});


module.exports = plugin;

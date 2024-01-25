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

const util = require('./EmailComposerUtil');

const {shell} = require('electron')
const {Buffer} = require("buffer");

/**
 * @param {*} props
 * @param {CallbackContext} callbackContext
 * @void
 */
function openMailtoUri(props, callbackContext)
{

    const mailTo = util.getMailToUri(props, true);
    shell.openExternal(mailTo.uri).then(() =>
    {
        callbackContext.success();
    }, (error) =>
    {
        callbackContext.error(error);
    });
}

/**
 * @typedef {Object} EMLFile
 * @property {string} file
 * @property {()=>void} close
 */

/**
 * create temp eml file and corresponding Windows.System.LauncherOptions
 * @param {EmailComposerOptions} props
 * @param {CallbackContext} callbackContext
 * @returns Promise<EMLFile>
 */
async function getEMLFile(props, callbackContext)
{
    const eml = util.getEMLContent(props);

    const tempDir = path.join(_file_plugin_util.paths().tempDirectory, "cordova-plugin-email-composer")
    const tempFile = path.join(tempDir, "draft.eml")

    await fs.mkdir(tempDir, {recursive: true})

        const buf = Buffer.from(eml.text);

        await fs.open(tempFile, 'w')
            .then(fd =>
            {
                return fs.write(fd, buf, 0, buf.length, 0)
                    .finally(() => fs.close(fd));
            })

    return {
        file: tempFile,
        options: {},
        close: function ()
        {
            eml.close();
            // wait until app has started and read the file
            setTimeout(function ()
            {
                return fs.remove(tempFile)
                    .catch((error) =>
                    {
                        console.error("cannot remove temp file " + tempFile, error);
                    });
            }, 60000);
        }
    }


}


/**
 * @param {EmailComposerOptions} props
 * @param {CallbackContext} callbackContext
 * @void
 */
function openEMLFile(props, callbackContext)
{
    getEMLFile(props, callbackContext).then((emlFile)=>{
        shell.openPath(emlFile.file).then((error) =>
        {
            emlFile.close();
            if(error && error.length > 0)
                callbackContext.error(error);
            else
                callbackContext.success();
        }, (error) =>
        {
            emlFile.close();
            callbackContext.error(error);
        });
    }, (error)=>{
        callbackContext.error(error);
    });

}


const emailComposerPlugin = {

    /**
     * @param {string | null} [app]
     * @param {CallbackContext} callbackContext
     * @void
     */
    account: ([app], callbackContext) =>
    {
        callbackContext.success(app === 'mailto:' || app === 'mailto' ? true : null)
    },
    /**
     * @param {CallbackContext} callbackContext
     * @void
     */
    client: ([], callbackContext) =>
    {
        callbackContext.success()
    },
    /**
     * @param {*} props
     * @param {CallbackContext} callbackContext
     * @void
     */
    open: ([props], callbackContext) =>
    {
        if (props.app === "emlFile")
        {
            openEMLFile(props, callbackContext);
        }
        else
        {
            if(util.isHtml(props))
            {
                callbackContext.error("cannot send html body via mailto uri");
                return;
            }
            openMailtoUri(props, callbackContext)
        }
    }
}

/**
 * @type {CordovaElectronPlugin}
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

let _file_plugin_util;

plugin.initialize = async (ctx)=>{
    _file_plugin_util = _file_plugin_util || (await ctx.getService('File')).util
}

module.exports = plugin;

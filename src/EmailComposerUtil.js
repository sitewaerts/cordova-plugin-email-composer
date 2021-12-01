// noinspection ES6ConvertVarToLetConst

/*
Copyright 2020 sitewaerts GmbH

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


/**
 * @typedef {Object} LaunchInfo
 * @property {()=>void} close
 */

/**
 * @typedef {LaunchInfo} LaunchInfoUri
 * @property {string} uri
 * @property {string} contentType
 */

/**
 * @typedef {LaunchInfo} LaunchInfoText
 * @property {string} text
 * @property {string} contentType
 */

var jQuery = window['$'];


// noinspection JSUnusedGlobalSymbols
var util = {

    /**
     * convert given markup to plain text.
     *
     * @param {String} markupText
     * @param {boolean} uriDelimiting
     * @return {String} plain text
     */
    toPlainText: function (markupText, uriDelimiting)
    {
        if (!markupText)
            return null;

        /**
         * @param {string} markupText
         * @param {string} tagName
         * @param {string} replacement
         * @return {string}
         */
        function replaceBodyTag(markupText, tagName, replacement)
        {
            markupText = markupText.replace(new RegExp("<" + tagName
                + " ?[^>]*>", "g"), "");
            markupText = markupText.replace(new RegExp("</" + tagName + ">",
                "g"), replacement);
            return markupText;
        }

        /**
         * @param {string} markupText
         * @return {string}
         */
        function replaceBrTag(markupText)
        {
            return markupText.replace(/\s*<br>\s*/g, "\n");
        }

        /**
         * @param {string} markupText
         * @return {string}
         */
        function replaceAnchorTag(markupText)
        {
            return markupText.replace(/<a [^>]*href="(.*)"[^>]*> *(.*) *<\/a>/g,
                function (all, href, content)
                {
                    // space after url makes url clickable even if its
                    // placed at the end of a line.

                    if (uriDelimiting)
                    {
                        // mark url for post processing with surroundLinks()
                        return content + " _link_start_" + href + "_link_end_ ";
                    }
                    else
                    {
                        return content + " " + href + " ";
                    }

                });
        }

        /**
         * @param {string} markupText
         * @return {string}
         */
        function surroundLinks(markupText)
        {
            return markupText.replace(/_link_start_(.*)_link_end_/g,
                function (all, url)
                {
                    // brackets around the url prevent line breaks in long
                    // urls in many email clients.
                    // see http://www.ietf.org/rfc/rfc2396.txt
                    // Section E., "Recommendations for Delimiting URI in Context".
                    return "<" + url + ">";
                });
        }

        markupText = markupText.replace(/\s*\n\s*/g, " ");
        markupText = markupText.replace(/>\s*</g, "><");

        markupText = replaceAnchorTag(markupText);
        markupText = replaceBrTag(markupText);

        markupText = replaceBodyTag(markupText, "h1", "\n\n\n");
        markupText = replaceBodyTag(markupText, "h2", "\n\n");
        markupText = replaceBodyTag(markupText, "p", "\n\n");

        if (jQuery)
        {
            // use jquery to expand all entities and remove all tags
            markupText = jQuery('<div>').html(markupText).text();
        }

        if (uriDelimiting)
            return surroundLinks(markupText);
        return markupText;
    },

    /**
     *
     * @param {string} value
     * @return {boolean}
     */
    isTrue: function (value)
    {
        return (value === true || value === 'true');
    },

    /**
     *
     * @param {*} props
     * @return {boolean}
     */
    isHtml: function (props)
    {
        return this.isTrue(props.isHtml);
    },

    /**
     *
     * @param {*} props
     * @return {string}
     */
    getFullContentType: function (props)
    {
        // tell outlook (or others) how to decode the url parameters (UTF-8)
        // and that we want to create a plain text or html email draft
        return this.getContentType(props) + '; charset=utf-8';
    },

    /**
     *
     * @param {*} props
     * @return {string}
     */
    getContentType: function (props)
    {
        // tell outlook (or others) how to decode the url parameters (UTF-8)
        // and that we want to create a plain text or html email draft

        if (this.isHtml(props))
            return 'text/html';
        else
            return 'text/plain';
    },

    /**
     *
     * @param {*} props
     * @param {boolean} appendContentType
     * @returns {LaunchInfoUri}
     */
    getMailToUri: function (props, appendContentType)
    {

        function appendParam(name, value)
        {
            if (value == null || value === '')
                return '';
            value = ([].concat(value)).join(",");
            if (value === '')
                return '';
            return '&' + name + "=" + encodeURIComponent(value);
        }

        var isHtml = this.isHtml(props);
        var body = props.body;

        // mailto links don't support html body
        if (isHtml)
            body = this.toPlainText(body, true);

        var contentType = this.getContentType(props);
        // The URI to launch
        var uriToLaunch = "mailto:" + ([].concat(props.to)).join(",");

        var options = '';

        if (appendContentType)
            options = options + appendParam('Content-Type', this.getFullContentType(props));

        options = options + appendParam('subject', props.subject);
        options = options + appendParam('cc', props.cc);
        options = options + appendParam('bcc', props.bcc);

        // append body as last param, as it may expire the uri max length
        options = options + appendParam('body', body);

        // cannot add attachments

        if (options !== '')
        {
            options = '?' + options.substring(1);
            uriToLaunch = uriToLaunch + options;
        }

        return {
            uri: uriToLaunch,
            contentType: contentType,
            close: function ()
            {
            }
        };
    },

    /**
     * could be used for browser
     *
     * eml files are supported by
     * - Outlook, Outlook Express
     * - Apple Mail
     * - Thunderbird
     *
     * eml files are not supported by
     * - windows mail app
     *
     * @return {boolean}
     */
    supportsEMLUri: function ()
    {
        return !!((window.URL || window.webkitURL) && Blob)
    },

    /**
     * could be used for browser
     * creates an blob url pointing to the email draft in eml format
     * @param {*} props
     * @return {LaunchInfoUri}
     */
    getEMLUri: function (props)
    {
        var eml = this.getEMLContent(props);

        var URL = window.URL || window.webkitURL;
        var blob = new Blob([eml.text], {type: eml.contentType});
        var url = URL.createObjectURL(blob);

        return {
            uri: url,
            contentType: eml.contentType,
            close: function ()
            {
                URL.revokeObjectURL(url);
                eml.close();
            }
        };
    },
    /**
     * see https://docs.fileformat.com/email/eml/
     * see https://github.com/mikel/mail/tree/master/spec/fixtures
     *
     * @param {*} props
     * @return {LaunchInfoText}
     */
    getEMLContent: function (props)
    {

        /**
         *
         * @param {string} name
         * @param {string | Array<string> | null} value
         * @return {string}
         */
        function appendParam(name, value)
        {
            if (value == null || value === '')
                return '';
            value = ([].concat(value)).join(",\n ");
            if (value === '')
                return '';

            return name + ": " + value + "\n";
        }

        var isHtml = this.isHtml(props);
        var fullContentType = this.getFullContentType(props);

        var emlText = '';
        emlText = emlText + appendParam('Content-Type', fullContentType);
        emlText = emlText + appendParam('X-Unsent', "1");
        emlText = emlText + appendParam('Subject', props.subject);
        emlText = emlText + appendParam("To", props.to);
        emlText = emlText + appendParam('Cc', props.cc);
        emlText = emlText + appendParam('Bcc', props.bcc);
        emlText = emlText + appendParam('Content-Type', fullContentType);
        emlText = emlText + "\n";

        if (isHtml)
        {
            emlText = emlText + '<html lang="en">\n';
            emlText = emlText + '<body>\n';
            emlText = emlText + props.body + '\n';
            emlText = emlText + '</body>\n';
            emlText = emlText + '</html>';
        }
        else
        {
            emlText = emlText + props.body;
        }

        //TODO: add attachments

        return {
            text: emlText,
            contentType: 'message/rfc822',
            close: function ()
            {
            }
        };
    }
};

module.exports = util;



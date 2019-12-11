// ==UserScript==
// @name        批量下载照片
// @name:zh     批量下载照片
// @name:en     Batch srcImage downloader
// @version     0.3
// @description   一键批量下载图片
// @description:zh  一键批量下载图片
// @description:en  Batch Download Image
// @supportURL  https://imcoder.site/article/detail?aid=124
// @match       http://item.meilishuo.com/*
// @grant       GM_xmlHttpRequest
// @grant       GM.xmlHttpRequest
// @grant       GM_notification
// @grant       GM_addStyle
// @require 	http://code.jquery.com/jquery-latest.js
// @require 	https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @author      Jeffrey.Deng
// @namespace https://greasyfork.org/users/129338
// ==/UserScript==

// @blog        https://imcoder.site
// @date        2018.4.1

// @更新日志
// v 0.3.1      2019.12.11     1.修复格式化数字排序未生效的问题
// V 0.3        2019.12.2      1.修改为toastr提示方式
//                             2.采用队列下载
// V 0.1        2018.4.1       打包成zip压缩包下载

(function (document, $) {

    $("head").append('<link rel="stylesheet" href="https://cdn.bootcss.com/toastr.js/2.1.3/toastr.min.css">');

    var common_utils = (function(document, $) {
        function parseURL(url) {
            var a = document.createElement('a');
            a.href = url;
            return {
                source: url,
                protocol: a.protocol.replace(':', ''),
                host: a.hostname,
                port: a.port,
                query: a.search,
                params: (function () {
                    var ret = {},
                        seg = a.search.replace(/^\?/, '').split('&'),
                        len = seg.length, i = 0, s;
                    for (; i < len; i++) {
                        if (!seg[i]) {
                            continue;
                        }
                        s = seg[i].split('=');
                        ret[s[0]] = s[1];
                    }
                    return ret;
                })(),
                file: (a.pathname.match(/\/([^\/?#]+)$/i) || [, ''])[1],
                hash: a.hash.replace('#', ''),
                path: a.pathname.replace(/^([^\/])/, '/$1'),
                relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [, ''])[1],
                segments: a.pathname.replace(/^\//, '').split('/')
            };
        }
        function ajaxDownload(url, callback, args) {
            var GM_download = GM.xmlHttpRequest || GM_xmlHttpRequest;
            GM_download({
                method: 'GET',
                responseType: 'blob',
                url: url,
                onreadystatechange: function(responseDetails) {
                    if (responseDetails.readyState === 4) {
                        if (responseDetails.status === 200 || responseDetails.status === 0) {
                            callback(responseDetails.response, args);
                        } else {
                            callback(null, args);
                        }
                    }
                },
                onerror: function(responseDetails) {
                    callback(null, args);
                    console.log(responseDetails.status);
                }
            });
            /*try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = "blob";
                xhr.onreadystatechange = function(evt) {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200 || xhr.status === 0) {
                            callback(xhr.response, args);
                        } else {
                            callback(null, args);
                        }
                    }
                };
                xhr.send();
            } catch (e) {
                callback(null, args);
            }*/
        }
        function fileNameFromHeader(disposition, url) {
            var result = null;
            if (disposition && /filename=.*/ig.test(disposition)) {
                result = disposition.match(/filename=.*/ig);
                return decodeURI(result[0].split("=")[1]);
            }
            return url.substring(url.lastIndexOf('/') + 1);
        }
        function downloadBlobFile(content, fileName) {
            if ('msSaveOrOpenBlob' in navigator) {
                navigator.msSaveOrOpenBlob(content, fileName);
            } else {
                var aLink = document.createElement('a');
                aLink.download = fileName;
                aLink.style = "display:none;";
                var blob = new Blob([content]);
                aLink.href = window.URL.createObjectURL(blob);
                document.body.appendChild(aLink);
                if (document.all) {
                    aLink.click(); //IE
                } else {
                    var evt = document.createEvent("MouseEvents");
                    evt.initEvent("click", true, true);
                    aLink.dispatchEvent(evt); // 其它浏览器
                }
                window.URL.revokeObjectURL(aLink.href);
                document.body.removeChild(aLink);
            }
        }
        function downloadUrlFile(url, fileName) {
            var aLink = document.createElement('a');
            if (fileName) {
                aLink.download = fileName;
            } else {
                aLink.download = url.substring(url.lastIndexOf('/') + 1);
            }
            aLink.target = "_blank";
            aLink.style = "display:none;";
            aLink.href = url;
            document.body.appendChild(aLink);
            if(document.all) {
                aLink.click(); //IE
            } else {
                var evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, true);
                aLink.dispatchEvent(evt ); // 其它浏览器
            }
            document.body.removeChild(aLink);
        }
        function paddingZero(num, length) {
            return (Array(length).join("0") + num).substr(-length);
        }
        /*  Class: TaskQueue
         *  Constructor: handler
         *      takes a function which will be the task handler to be called,
         *      handler should return Deferred object(not Promise), if not it will run immediately;
         *  methods: append
         *      appends a task to the Queue. Queue will only call a task when the previous task has finished
         */
        var TaskQueue = function (handler) {
            var tasks = [];
            // empty resolved deferred object
            var deferred = $.when();

            // handle the next object
            function handleNextTask() {
                // if the current deferred task has resolved and there are more tasks
                if (deferred.state() == "resolved" && tasks.length > 0) {
                    // grab a task
                    var task = tasks.shift();
                    // set the deferred to be deferred returned from the handler
                    deferred = handler(task);
                    // if its not a deferred object then set it to be an empty deferred object
                    if (!(deferred && deferred.promise)) {
                        deferred = $.when();
                    }
                    // if we have tasks left then handle the next one when the current one
                    // is done.
                    if (tasks.length >= 0) {
                        deferred.fail(function () {
                            tasks = [];
                            return;
                        });
                        deferred.done(handleNextTask);
                    }
                }
            }

            // appends a task.
            this.append = function (task) {
                // add to the array
                tasks.push(task);
                // handle the next task
                handleNextTask();
            };
        };
        var context = {
            "ajaxDownload": ajaxDownload,
            "fileNameFromHeader": fileNameFromHeader,
            "downloadBlobFile": downloadBlobFile,
            "downloadUrlFile": downloadUrlFile,
            "parseURL": parseURL,
            "paddingZero": paddingZero,
            "TaskQueue": TaskQueue
        };
        return context;
    })(document, jQuery);

    var options = {
        "type": 2,
        "isNeedConfirmDownload": true,
        "useQueueDownloadThreshold": 0,
        "suffix": null,
        "callback": {
            "parseLocationInfo_callback": function (location_info, options) {
                return common_utils.parseURL(document.location.href);
            },
            "parseFiles_callback": function (location_info, options) {
                // file.url file.folder_sort_index
                // not folder_sort_index -> use fileName
                var files = [];
                return files;
            },
            "makeNames_callback": function (arr, location_info, options) {
                var names = {};
                var time = new Date().getTime();
                names.zipName = "pack_" + time;
                names.folderName = names.zipName;
                names.infoName = null;
                names.infoValue = null;
                names.prefix = time;
                names.suffix = options.suffix;
                return names;
            },
            "beforeFilesDownload_callback": function (files, names, location_info, options, zip, main_folder) {
            },
            "eachFileOnload_callback": function (blob, file, location_info, options, zipFileLength, zip, main_folder, folder) {
            },
            "allFilesOnload_callback": function (files, names, location_info, options, zip, main_folder) {
            },
            "beforeZipFileDownload_callback": function (zip_blob, files, names, location_info, options, zip, main_folder) {
                common_utils.downloadBlobFile(zip_blob, names.zipName + ".zip");
            }
        }
    };

    var ajaxDownloadAndZipFiles = function (files, names, location_info, options) {
        // GM_notification("开始下载～", names.zipName);
        var notify_start = toastr.success("正在打包～", names.zipName, {
            "progressBar": false,
            "hideDuration": 0,
            "showDuration": 0,
            "timeOut": 0,
            "closeButton": false
        });
        if (files && files.length > 0) {
            var zip = new JSZip();
            var main_folder = zip.folder(names.folderName);
            var zipFileLength = 0;
            var maxIndex = files.length;
            var paddingZeroLength = (files.length + "").length;
            if (names.infoName) {
                main_folder.file(names.infoName, names.infoValue);
            }
            options.callback.beforeFilesDownload_callback(files, names, location_info, options, zip, main_folder);
            var downloadFile = function (file, resolveCallback) {
                common_utils.ajaxDownload(file.url, function (blob, file) {
                    var folder = file.location ? main_folder.folder(file.location) : main_folder;
                    var isSave = options.callback.eachFileOnload_callback(blob, file, location_info, options, zipFileLength, zip, main_folder, folder);
                    if (isSave != false) {
                        if (file.fileName) {
                            folder.file(file.fileName, blob);
                        } else {
                            var suffix = names.suffix || file.url.substring(file.url.lastIndexOf('.') + 1);
                            file.fileName = names.prefix + "_" + common_utils.paddingZero(file.folder_sort_index, paddingZeroLength) + "." + suffix;
                            folder.file(file.fileName, blob);
                        }
                    }
                    zipFileLength++;
                    notify_start.find(".toast-message").text("正在打包～ 第 " + zipFileLength + " 张");
                    resolveCallback && resolveCallback();   // resolve延迟对象
                    if (zipFileLength >= maxIndex) {
                        options.callback.allFilesOnload_callback(files, names, location_info, options, zip, main_folder);
                        zip.generateAsync({type: "blob"}).then(function (content) {
                            options.callback.beforeZipFileDownload_callback(content, files, names, location_info, options, zip, main_folder);
                        });
                        // GM_notification({text: "打包下载完成！", title: names.zipName, highlight : true});
                        notify_start.css("display", "none").remove();
                        toastr.success("下载完成！", names.zipName, {"progressBar": false}, {"progressBar": false, timeOut: 0});
                    }
                }, file);
            };
            if (maxIndex < options.useQueueDownloadThreshold) {
                // 并发数在useQueueDownloadThreshold内，直接下载
                for (var i = 0; i < maxIndex; i++) {
                    downloadFile(files[i]);
                }
            } else {
                // 并发数在useQueueDownloadThreshold之上，采用队列下载
                var queue = new common_utils.TaskQueue(function (file) {
                    if (file) {
                        var dfd = $.Deferred();
                        downloadFile(file, function () {
                            dfd.resolve();
                        });
                        return dfd;
                    }
                });
                for (var j = 0; j < maxIndex; j++) {
                    queue.append(files[j]);
                }
            }
        } else {
            toastr.remove(notify_start, true);
            toastr.error("未解析到图片！", "错误", {"progressBar": false});
        }
    };

    /** 批量下载 **/
    function batchDownload(config) {
        try {
            options = $.extend(true, options, config);
            var location_info = options.callback.parseLocationInfo_callback(options);
            var files = options.callback.parseFiles_callback(location_info, options);

            if (files && files.length > 0) {
                if (options.isNeedConfirmDownload && confirm("是否下载 " + files.length + " 张图片")) {
                    if (options.type == 1) {
                        urlDownload(files, names, location_info, options);
                    } else {
                        var names = options.callback.makeNames_callback(files, location_info, options);
                        ajaxDownloadAndZipFiles(files, names, location_info, options);
                    }
                }
            } else {
                toastr.error("未找到图片~", "");
            }
        } catch (e) {
            // GM_notification("批量下载照片 出现错误！", "");
            console.warn("批量下载照片 出现错误！, exception: ", e);
            toastr.error("批量下载照片 出现错误！", "");
        }

    }

    /** 下载 **/
    function urlDownload(photos, names, location_info, options) {
        GM_notification("开始下载～", names.zipName);
        var index = 0;
        var interval = setInterval(function () {
            if (index < photos.length) {
                var url = photos[index].url;
                var fileName = null;
                if (!names.suffix) {
                    fileName = names.prefix + "_" + (index + 1) + url.substring(url.lastIndexOf('.'));
                } else {
                    fileName = names.prefix + "_" + (index + 1) + "." + names.suffix;
                }
                common_utils.downloadUrlFile(url, fileName);
            } else {
                clearInterval(interval);
                return;
            }
            index++;
        }, 100);
    }

    /*** start main ***/

    if (typeof GM_addStyle == 'undefined') {
        this.GM_addStyle = (aCss) => {
            'use strict';
            let head = document.getElementsByTagName('head')[0];
            if (head) {
                let style = document.createElement('style');
                style.setAttribute('type', 'text/css');
                style.textContent = aCss;
                head.appendChild(style);
                return style;
            }
            return null;
        };
    }

    function addDownloadBtn() {
        GM_addStyle(
            ".goBottom { " +
            "    display: block; " +
            "    width: 38px; " +
            "    height: 38px; " +
            "    background-color: #ddd; " +
            "    border-radius: 3px; " +
            "    border: 0; " +
            "    cursor: pointer; " +
            "    position: fixed; " +
            "    right: 50px; " +
            "    bottom: -40px; " +
            "} " +
            ".goBottom .arrow { " +
            "    width: 0; " +
            "    height: 0; " +
            "    bottom: 6px; " +
            "    border-width: 9px 9px 0; " +
            "    border-style: solid; " +
            "    border-color: transparent; " +
            "    border-top-color: #429e46; " +
            "} " +
            ".goBottom div { " +
            "    position: absolute; " +
            "    right: 0; " +
            "    left: 0; " +
            "    margin: auto; " +
            "} " +
            ".goBottom .stick { " +
            "    width: 8px; " +
            "    height: 14px; " +
            "    top: 9px; " +
            "    border-radius: 1px; " +
            "    background-color: #429e46; }"
        );

        $("body").append(
            '<div id="batchDownloadBtn" class="goBottom" style="bottom: 30px;z-index: 10000" title="点击打包下载所有图片"><div class="stick"></div><div class="arrow"></div>'
        );
    }

    addDownloadBtn();

    $('#batchDownloadBtn').click(function () {
        unsafeWindow.attrangsPhotoDownload();
    });

    // attrangs
    unsafeWindow.attrangsPhotoDownload = function (options) {
        var config = {
            "type": 2,
            "callback": {
                "parseFiles_callback": function (location_info, options) {
                    var photo_arr = [];
                    $.each($("#J_Graphic_穿着效果").find("img"), function(i, dom){
                        var photo = {};
                        var link = dom.src;
                        link = link.substring(0, link.lastIndexOf("_"));
                        photo.url = link;
                        //photo.fileName = link.substring(link.lastIndexOf("/")).replace(/_\d+x\d+/, '');
                        photo.folder_sort_index = i + 1;
                        photo_arr.push(photo);
                    });
                    return photo_arr;
                },
                "makeNames_callback": function (photos, location_info, options) {
                    var names = {};
                    names.zipName = "batch_down";
                    names.folderName = names.zipName;
                    names.prefix = "1keksvc_170531";
                    names.suffix = null;
                    return names;
                },
                "beforeFilesDownload_callback": function(photos, names, location_info, options, zip, main_folder) {
                },
                "eachFileOnload_callback": function(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
                }
            }
        };
        if (options) {
            $.extend(true, config , options);
        }
        batchDownload(config);
    };


})(document, jQuery);
(function (document, $) {

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
        var context = {
            "ajaxDownload": ajaxDownload,
            "fileNameFromHeader": fileNameFromHeader,
            "downloadBlobFile": downloadBlobFile,
            "downloadUrlFile": downloadUrlFile,
            "parseURL": parseURL
        };
        return context;
    })(document, jQuery);

    var location_info = common_utils.parseURL(document.location.href);
    var options = {
        "type": 2,
        "suffix": null,
        "callback" : {
            "parsePhotos_callback": function (location_info, options) {
                var photos = [];
                return photos;
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
            "beforeFileDownload_callback": function(photos, location_info, options, zip, main_folder) {
            },
            "eachFileOnload_callback": function(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
            }
        }
    };

    /** 批量下载 **/
    function batchDownload(config) {
        try {
            $.extend(true, options, config);
            var photos = [];
            if (options.callback.parsePhotos_callback) {
                photos = options.callback.parsePhotos_callback(location_info, options);
            }

            if (photos && photos.length > 0) {
                if (confirm("是否下载 " + photos.length + " 张图片")) {
                    var names = options.callback.makeNames_callback(photos, location_info, options);
                    if (options.type == 1) {
                        urlDownload(photos, names, location_info, options);
                    } else {
                        ajaxDownloadAndZipPhotos(photos, names, location_info, options);
                    }
                }
            } else {
                GM_notification({text: "未匹配到图片", title: "错误", highlight : true});
            }
        } catch (e) {
            console.log("批量下载照片 出现错误！");
            GM_notification("批量下载照片 出现错误！", "");
            console.log(e);
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

    var ajaxDownloadAndZipPhotos = function (photos, names, location_info, options) {
        GM_notification("开始下载～", names.zipName);
        if (photos && photos.length > 0) {
            var zip = new JSZip();
            var main_folder = zip.folder(names.folderName);
            var zipFileLength = 0;
            if (names.infoName) {
                main_folder.file(names.infoName, names.infoValue);
            }
            options.callback.beforeFileDownload_callback(photos, names, location_info, options, zip, main_folder);
            for (var i = 0, maxIndex = photos.length; i < maxIndex; i++) {
                common_utils.ajaxDownload(photos[i].url, function (blob, photo) {
                    var folder = photo.location ? main_folder.folder(photo.location) : main_folder;
                    var isSave = options.callback.eachFileOnload_callback(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder);
                    if (isSave != false) {
                        if (photo.fileName) {
                            folder.file(photo.fileName, blob);
                        } else {
                            var suffix = names.suffix || photo.url.substring(photo.url.lastIndexOf('.') + 1);
                            var photoName = names.prefix + "_" + photo.folder_sort_index + "." + suffix;
                            folder.file(photoName, blob);
                        }
                    }
                    zipFileLength++;
                    if (zipFileLength >= maxIndex) {
                        zip.generateAsync({type: "blob"}).then(function (content) {
                            common_utils.downloadBlobFile(content, names.zipName + ".zip");
                        });
                        GM_notification({text: "打包下载完成！", title: names.zipName, highlight : true});
                    }
                }, photos[i]);
            }
        }
    };
})(document, jQuery);
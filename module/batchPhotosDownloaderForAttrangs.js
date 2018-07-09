// ==UserScript==
// @name        批量下载Attrangs照片
// @name:zh     批量下载Attrangs照片
// @name:en     Batch srcImage downloader for Attrangs
// @version     0.2
// @description   一键批量下载Attrangs中的图片
// @description:zh  一键批量下载Attrangs中的图片
// @description:en  Batch Download Image From Attrangs
// @supportURL  https://imcoder.site/article.do?method=detail&aid=124
// @match       http://attrangs.co.kr/*
// @match       https://attrangs.co.kr/*
// @match       http://cn.attrangs.com/*
// @match       https://cn.attrangs.com/*
// @match       http://justone.co.kr/*
// @match       http://www.justone.co.kr/*
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
// V 0.2        2018.4.7       增加对justone.co.kr的支持
// V 0.1        2018.4.1       打包成zip压缩包下载

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

    function doSomethingBeforePageLoad() {
        var location_info = common_utils.parseURL(document.location.href);
        if (location_info.host == "attrangs.co.kr" || location_info.host == "cn.attrangs.com") {
            if (location_info.file == "view.php" && location_info.params.hasOwnProperty("cate")) {
                var search = "";
                $.each(location_info.params, function (key, value) {
                    if(key != "cate") {
                        search += "&" + key + "=" + value;
                    }
                });
                search = search.substring(search.indexOf("&") == -1 ? 0 : 1);
                history.replaceState(
                    null,
                    document.title,
                    location_info.protocol + "://" + location_info.host + location_info.path + "?" + search
                );
            }
        } else if (location_info.host == "justone.co.kr" || location_info.host == "www.justone.co.kr") {
            if (location_info.file == "shopdetail.html" && location_info.params.branduid) {
                var jt_search = "?branduid=" + location_info.params.branduid;
                history.replaceState(
                    null,
                    document.title,
                    location_info.protocol + "://" + location_info.host + location_info.path + jt_search
                );
            }
            var R = function (a) {
                var ona = "on" + a;
                if (window.addEventListener){
                    window.addEventListener(a, function (e) {
                        for (var n = e.originalTarget; n; n = n.parentNode){
                            n[ona] = null;
                        }
                    }, true);
                }
                window[ona] = null;
                document[ona] = null;
                if (document.body){
                    document.body[ona] = null;
                }
            };
            R("contextmenu");R("click");R("mousedown");R("mouseup");R("selectstart");
        }
    }

    doSomethingBeforePageLoad();
    addDownloadBtn();

    $('#batchDownloadBtn').click(function () {
        var location_info = common_utils.parseURL(document.location.href);
        if (location_info.host == "attrangs.co.kr" || location_info.host == "cn.attrangs.com") {
            unsafeWindow.attrangsPhotoDownload();
        } else if (location_info.host == "justone.co.kr" || location_info.host == "www.justone.co.kr") {
            unsafeWindow.justonePhotoDownload();
        }
    });

    // attrangs
    unsafeWindow.attrangsPhotoDownload = function (options) {
        var config = {
            "type": 2,
            "callback": {
                "parsePhotos_callback": function (location_info, options) {
                    var photo_arr = [];
                    if (location_info.host == "attrangs.co.kr") {
                        var kr_part_nodes_one = $('.detailPage .left .thumb ul li a');
                        var kr_part_nodes_two = $('.viewCon').eq(1).find("img");
                        var kr_part_nodes_three = null;
                        var kr_part_nodes_four = null;
                        if($('.detailPage .likeSlides').length == 2) {
                            kr_part_nodes_three = $('.detailPage .likeSlides').eq(0).find("a");
                            kr_part_nodes_four = $('.detailPage .likeSlides').eq(1).find("a");
                        } else {
                            kr_part_nodes_three = $('.detailPage .likeSlides').eq(1).find("a");
                            kr_part_nodes_four = $('.detailPage .likeSlides').eq(0).find("a");
                        }

                        $.each(kr_part_nodes_one, function (i, a){
                            var photo = {};
                            photo.url = null;
                            if ($(this).data("video") == "") {
                                photo.url = $(this).data('href');
                                photo.type = "image";
                            } else {
                                photo.url = $(this).data('video');
                                photo.type = "video";
                            }
                            photo.location = "summary";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        var gif_url = $('head meta[property="og:image"]').attr("content");
                        photo_arr.push({
                            "url": "http://atimg.sonyunara.com/files/attrangs/" + gif_url.substring(gif_url.indexOf('goods')),
                            "location": "summary",
                            "folder_sort_index": photo_arr.length + 1
                        });

                        $.each(kr_part_nodes_two, function (i, img){
                            var photo = {};
                            photo.url = img.src;
                            photo.location = "detail";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        $.each(kr_part_nodes_three, function (i, a){
                            var photo = {};
                            var img = $(a).find("img");
                            photo.url = img.get(0).src;
                            photo.location = "like";
                            photo.folder_sort_index = i + 1;
                            photo.good_name = img.attr("alt");
                            photo.good_url = a.href;
                            photo_arr.push(photo);
                        });

                        $.each(kr_part_nodes_four, function (i, a){
                            var photo = {};
                            var img = $(a).find("img");
                            photo.url = img.get(0).src;
                            photo.location = "relation";
                            photo.folder_sort_index = i + 1;
                            photo.good_name = img.attr("alt");
                            photo.good_url = a.href;
                            photo_arr.push(photo);
                        });

                    } else if (location_info.host == "cn.attrangs.com") {
                        var cn_part_nodes_one = [];
                        cn_part_nodes_one.push($("#container .xans-product-detail .detailArea .keyImg img"));
                        cn_part_nodes_one.push($("#container .xans-product-detail .detailArea .listImg img"));
                        var cn_part_nodes_two = $('#prdRelated .bxslider_slide03_wrapper .xans-record-');
                        var cn_part_nodes_three = $('#prdDetail div img');

                        $.each(cn_part_nodes_one, function (i, img){
                            var photo = {};
                            photo.url = img.get(0).src;
                            photo.location = "summary";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        if ($("#prdRelated").length > 0) {
                            $.each(cn_part_nodes_two, function (i, li){
                                var photo = {};
                                var img = $(li).find("img");
                                photo.url = img.get(0).src;
                                photo.location = "relation";
                                photo.folder_sort_index = i + 1;
                                var a = $(li).find(".name").find("a");
                                photo.good_name = a.text();
                                photo.good_url = a.get(0).href;
                                photo_arr.push(photo);
                            });
                        }

                        $.each(cn_part_nodes_three, function (i, img){
                            var photo = {};
                            photo.url = img.src;
                            photo.location = "detail";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });
                    }
                    return photo_arr;
                },
                "makeNames_callback": function (photos, location_info, options) {
                    var names = {};
                    if (location_info.host == "attrangs.co.kr") {
                        var product_property_node = $(".aw-product");
                        var good_id = product_property_node.find('div[data-product-property="id"]').text();
                        var good_name = product_property_node.find('div[data-product-property="title"]').text();
                        var good_keyName = good_name.substring(0, good_name.indexOf(" ")) || good_id;
                        var good_type_little = product_property_node.find('div[data-product-property="product_type"]').text();
                        var good_type_large = good_type_little.substring(0, 4);
                        var good_description = product_property_node.find('div[data-product-property="description"]').text();
                        var good_price = product_property_node.find('div[data-product-property="price"]').text();
                        var good_cover = product_property_node.find('div[data-product-property="image_link"]').text();
                        names.infoName = "clothing_info.txt";
                        names.infoValue = "good_id：" + good_id + "\r\n" +
                            "good_keyName：" + good_keyName + "\r\n" +
                            "good_name：" + good_name + "\r\n" +
                            "good_type_large：" + good_type_large + "/" + $(".detailPage .right .location").find("a").eq(1).text() + "\r\n" +
                            "good_type_little：" + good_type_little + "/" + $(".detailPage .right .location").find("a").eq(2).text() + "\r\n" +
                            "good_description：" + good_description + "\r\n" +
                            "good_price：" + good_price + "\r\n" +
                            "good_cover：" + good_cover + "\r\n" +
                            "page_url：" + location_info.source + "\r\n" +
                            "image_amount：" + photos.length + "\r\n";
                        names.zipName = "attrangs_" + good_keyName;
                        names.folderName = good_keyName;
                        names.prefix = good_keyName;
                        names.suffix = null;
                        names.good = {};
                        names.good.good_id = good_id;
                        names.good.good_keyName = good_keyName;
                        names.good.good_name = good_name;
                    } else if (location_info.host == "cn.attrangs.com") {
                        var cn_good_id = location_info.segments[2];
                        var cn_good_name = $(".infoArea .product_name_css").find("td").eq(0).text();
                        var cn_good_keyName = cn_good_id;
                        if(/^[a-zA-Z]+[\d]+$/.test(location_info.segments[1])) {
                           cn_good_keyName = location_info.segments[1];
                        } else if (/^[a-zA-Z]+[\d]+.*?/.test(cn_good_name)) {
                           cn_good_keyName = cn_good_name.substring(0, cn_good_name.indexOf(" "));
                        }
                        var cate_nodes = $("#container  .xans-product-headcategory li");
                        var cn_good_type_little = cate_nodes.eq(2).find("a").text();
                        var cn_good_type_little_href = cate_nodes.eq(2).find("a").get(0).href;
                        var cn_good_type_large = cate_nodes.eq(1).find("a").text();
                        var cn_good_type_large_href = cate_nodes.eq(1).find("a").get(0).href;
                        var cn_good_price = $("#span_product_price_text").text();
                        var cn_good_cover = $("#container .xans-product-detail .detailArea .keyImg img").get(0).src;
                        var cn_good_description = ($("#span_additional_description_translated").length > 0 ? $("#span_additional_description_translated").text() : "");
                        names.infoName = "clothing_info.txt";
                        names.infoValue = "good_id：" + cn_good_id + "\r\n" +
                            "good_keyName：" + cn_good_keyName + "\r\n" +
                            "good_name：" + cn_good_name + "\r\n" +
                            "good_type_large：" + cn_good_type_large + "（" + cn_good_type_large_href + "）\r\n" +
                            "good_type_little：" + cn_good_type_little + "（" + (cn_good_type_little ? cn_good_type_little_href : "") + "）\r\n" +
                            "good_description：" + cn_good_description + "\r\n" +
                            "good_price：" + cn_good_price + "\r\n" +
                            "good_cover：" + cn_good_cover + "\r\n" +
                            "page_url：" + decodeURIComponent(decodeURIComponent(location_info.source)) + "\r\n" +
                            "image_amount：" + photos.length + "\r\n";
                        names.zipName = "attrangs_" + cn_good_keyName;
                        names.folderName = cn_good_keyName;
                        names.prefix = cn_good_keyName;
                        names.suffix = null;
                        names.good = {};
                        names.good.good_id = cn_good_id;
                        names.good.good_keyName = cn_good_keyName;
                        names.good.good_name = cn_good_name;
                    }
                    return names;
                },
                "beforeFileDownload_callback": function(photos, names, location_info, options, zip, main_folder) {
                    var photo_urls_str = "";

                    // 保存html文件
                    var htmlNode = document.cloneNode(true);
                    var pageDom = $(htmlNode);

                    // 删除脚本，添加一个点击切换图片方法
                    pageDom.find("script").each(function(i, script){
                        $(script).remove();
                    });
                    pageDom.find('.detailPage .left .thumb ul li a').addClass("clickToChange");
                    pageDom.find('.detailPage .left .photo img').attr("id","clickToChange-img");
                    pageDom.find("body").append(
                     "<script type='text/javascript'>var arr = document.getElementsByClassName('clickToChange');for(var i=0;i<arr.length;i++){arr[i].onclick= function(){if (this.getAttribute('data-video') == ''){" +
					"var path = this.getAttribute('data-href');var img = document.getElementById('clickToChange-img');img.setAttribute('src',path);img.style =  img.style + 'visibility:visible';" +
					"} else {document.getElementById('goods_video').innerHTML = this.getAttribute('data-video');}};}"
					);

                    // 替换相对url为绝对url
                    pageDom.find("img").each(function(i, img){
                        img.setAttribute("src", img.src);
                    });
                    pageDom.find("link").each(function(i, style){
                        if(style.getAttribute("href")) {
                            style.setAttribute("href", style.href);
                        }
                    });
                    pageDom.find("a").each(function(i, a){
                        if(a.getAttribute("href")) {
                            a.setAttribute("href", a.href);
                        }
                    });

                    //pageHtml = pageDom.children(0)[0].outerHTML;

                    $.each(photos, function(i, photo){
                        var photoDefaultName = names.prefix + "_" + photo.folder_sort_index + "." + (names.suffix || photo.url.substring(photo.url.lastIndexOf('.') + 1));
                        var photo_save_path = ((photo.location ? (photo.location + "/") : "" ) + photoDefaultName);
                        if (location_info.host == "attrangs.co.kr") {
                            if (photo.location == "like" || photo.location == "relation") {
                                var kr_good_keyName = photo.good_name.substring(0, photo.good_name.indexOf(" "));
                                photo_save_path = ((photo.location ? (photo.location + "/") : "" ) + kr_good_keyName + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1));
                            } else if (photo.location == "summary" && photo.type == "video") {
                                photo_save_path = (photo.location ? (photo.location + "/") : "" ) + "video_info.txt";
                            }
                        } else if (location_info.host == "cn.attrangs.com") {
                            if (photo.location == "relation") {
                                var cn_good_keyName = "";
                                if (/^[a-zA-Z]+[\d]+.*?/.test(photo.good_name)) {
                                    cn_good_keyName = photo.good_name.substring(0, photo.good_name.indexOf(" "));
                                } else {
                                    cn_good_keyName = common_utils.parseURL(photo.good_url).params.product_no;
                                }
                                photo_save_path = ((photo.location ? (photo.location + "/") : "" ) + cn_good_keyName + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1));
                            }
                        }
                        photo_urls_str +=  (photo_save_path + "\t" + photo.url + "\r\n");

                        // 替换html文件中图片地址为本地文件地址
                        if (photo.type != "video") {
                            pageDom.find('img[src="' + photo.url + '"]').attr("src", "./" + photo_save_path);
                            pageDom.find('a[data-href="' + photo.url + '"]').attr("data-href", "./" + photo_save_path);
                        }
                        //pageHtml.replace(new RegExp(photo.url,"gm"), "./" + photo_save_path);
                    });
                    main_folder.file("photo_url_list.txt", photo_urls_str); // 图片链接列表
                    main_folder.file("page.html", pageDom.children(0)[0].outerHTML); // 保存本页面的html文件
                },
                "eachFileOnload_callback": function(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
                    if (location_info.host == "attrangs.co.kr") {
                        if (photo.location == "like" || photo.location == "relation") {
                            var kr_good_keyName = photo.good_name.substring(0, photo.good_name.indexOf(" "));
                            photo.fileName = kr_good_keyName + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1);
                            folder.file(kr_good_keyName + "_info.txt", "good_keyName：" + kr_good_keyName + "\r\n" + "good_name：" + photo.good_name + "\r\n" + "good_url：" + photo.good_url);
                        } else if (photo.location == "summary" && photo.type == "video") {
                            folder.file("video_" + zipFileLength + ".txt", photo.url);
                            return false;
                        }
                    } else if (location_info.host == "cn.attrangs.com") {
                        if (photo.location == "relation") {
                            var cn_good_keyName = "";
                            if (/^[a-zA-Z]+[\d]+.*?/.test(photo.good_name)) {
                                cn_good_keyName = photo.good_name.substring(0, photo.good_name.indexOf(" "));
                            } else {
                                cn_good_keyName = common_utils.parseURL(photo.good_url).params.product_no;
                            }
                            photo.fileName = cn_good_keyName + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1);
                            folder.file(cn_good_keyName + "_info.txt", "good_keyName：" + cn_good_keyName + "\r\n" + "good_name：" + photo.good_name + "\r\n" + "good_url：" + photo.good_url);
                        }
                    }
                    return true;
                }
            }
        };
        if (options) {
            $.extend(true, config , options);
        }
        batchDownload(config);
    };

    // justone
    unsafeWindow.justonePhotoDownload = function (options) {
        var config = {
            "type": 2,
            "shopdetail_url": "http://justone.co.kr/shop/shopdetail.html",
            "callback": {
                "parseLocationInfo_callback": function (location_info, options) {
                    return common_utils.parseURL(document.location.href);
                },
                "parsePhotos_callback": function (location_info, options) {
                    var photo_arr = [];
                    if (location_info.host == "justone.co.kr" || location_info.host == "www.justone.co.kr") {
                        var kr_part_nodes_one = $('#productDetail .thumb-wrap .origin-img a');
                        //var kr_part_nodes_two = $('#productDetail .tmb-info .SMP-container').next().find('iframe').find('table .thumbnail-wrap img');
                        var kr_part_nodes_three = $('#productDetail #detailCnt1 .prd-detail center img');
                        var kr_part_nodes_four = $('#SP_slider_detail_recommend_wrap .SP_slider_detail .bx-viewport .product').not('.bx-clone');
                        //var kr_part_nodes_five = $('#productDetail #detailCnt4 iframe table .thumbnail-wrap img');

                        $.each(kr_part_nodes_one, function (i, a){
                            var photo = {};
                            var img = $(a).find("img");
                            photo.location = "summary";
                            var sp_index = img.get(0).src.indexOf('?');
                            photo.url = (sp_index == -1 ? img.get(0).src : img.get(0).src.substring(0, sp_index));
                            img.attr("src", photo.url);
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        /*$.each(kr_part_nodes_two, function (i, img){
                            var photo = {};
                            photo.location = "collocation";
                            var sp_index = img.src.indexOf('?');
                            photo.url = (sp_index == -1 ? img.src : img.src.substring(0, sp_index));
                            img.src = photo.url;
                            photo.folder_sort_index = i + 1;
                            var good_url = img.parentNode.parentNode.href;
                            var good_id = good_url.substring(good_url.indexOf('branduid') + 9);
                            photo.good_url = options.shopdetail_url + "?branduid=" + good_id;
                            photo.good_id = good_id;
                            photo_arr.push(photo);
                        });*/

                        $.each(kr_part_nodes_three, function (i, img){
                            var photo = {};
                            photo.url = img.src;
                            photo.location = "detail";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        $.each(kr_part_nodes_four, function (i, li){
                            var photo = {};
                            var good_id = li.id.substring(li.id.lastIndexOf('_') + 1);
                            photo.good_url = options.shopdetail_url + "?branduid=" + good_id;
                            photo.good_id = good_id;
                            var img = $(li).find("img");
                            var sp_index = img.attr('big').indexOf('?');
                            img.attr("big", (sp_index == -1 ? img.attr('big') : img.attr('big').substring(0, sp_index)));
                            photo.url = img.get(0).src.substring(0, img.get(0).src.indexOf('/shopimages/')) + img.attr('big');
                            img.attr("src", photo.url);
                            photo.location = "relation";
                            photo.folder_sort_index = i + 1;
                            photo_arr.push(photo);
                        });

                        /*$.each(kr_part_nodes_five, function (i, img){
                            var photo = {};
                            photo.location = "like";
                            var sp_index = img.src.indexOf('?');
                            photo.url = (sp_index == -1 ? img.src : img.src.substring(0, sp_index));
                            img.src = photo.url;
                            photo.folder_sort_index = i + 1;
                            var good_url = img.parentNode.parentNode.href;
                            var good_id = good_url.substring(good_url.indexOf('branduid') + 9);
                            photo.good_url = options.shopdetail_url + "?branduid=" + good_id;
                            photo.good_id = good_id;
                            photo_arr.push(photo);
                        });*/
                    }
                    return photo_arr;
                },
                "makeNames_callback": function (photos, location_info, options) {
                    // tb_tagManager
                    var names = {};
                    if (location_info.host == "justone.co.kr" || location_info.host == "www.justone.co.kr") {
                        var product_property_node = $(".tb_tagManager");
                        var good_id = product_property_node.find('.itemId').text();
                        var good_name = product_property_node.find('.itemName').text();
                        var good_keyName = good_name.substring(0, good_name.indexOf("_")) || good_id;
                        var good_type_little = product_property_node.find('.categoryName2').text() + "(" + product_property_node.find('.categoryCode2').text() + ")";
                        var good_type_large = product_property_node.find('.categoryName1').text() + "(" + product_property_node.find('.categoryCode1').text() + ")";
                        var good_description = product_property_node.find('.itemDesc').text();
                        var good_price = product_property_node.find('.itemPrice').text();
                        var good_cover = "http://" + location_info.host + product_property_node.find('.itemImg1').text();
                        names.infoName = "clothing_info.txt";
                        names.infoValue = "good_id：" + good_id + "\r\n" +
                            "good_keyName：" + good_keyName + "\r\n" +
                            "good_name：" + good_name + "\r\n" +
                            "good_type_large：" + good_type_large + "\r\n" +
                            "good_type_little：" + good_type_little + "\r\n" +
                            "good_description：" + good_description + "\r\n" +
                            "good_price：" + good_price + "\r\n" +
                            "good_cover：" + good_cover + "\r\n" +
                            "page_url：" + (options.shopdetail_url + "?branduid=" + good_id) + "\r\n" +
                            "image_amount：" + photos.length + "\r\n";
                        names.zipName = "justone_" + good_id;
                        names.folderName = good_id;
                        names.prefix = good_id;
                        names.suffix = null;
                        names.good = {};
                        names.good.good_id = good_id;
                        names.good.good_keyName = good_keyName;
                        names.good.good_name = good_name;
                    }
                    return names;
                },
                "beforeFileDownload_callback": function(photos, names, location_info, options, zip, main_folder) {
                    // 保存html文件
                    var htmlNode = document.cloneNode(true);
                    var pageDom = $(htmlNode);

                    // 删除脚本，添加一个点击切换图片方法
                    pageDom.find("script").each(function(i, script){
                        $(script).remove();
                    });

                    // 替换相对url为绝对url
                    pageDom.find("img").each(function(i, img){
                        img.setAttribute("src", img.src);
                    });
                    pageDom.find("link").each(function(i, style){
                        if(style.getAttribute("href")) {
                            style.setAttribute("href", style.href);
                        }
                    });
                    pageDom.find("a").each(function(i, a){
                        if(a.getAttribute("href")) {
                            a.setAttribute("href", a.href);
                        }
                    });

                    var photo_urls_str = "";
                    $.each(photos, function(i, photo){
                        var photoDefaultName = names.prefix + "_" + photo.folder_sort_index + "." + (names.suffix || photo.url.substring(photo.url.lastIndexOf('.') + 1));
                        var photo_save_path = ((photo.location ? (photo.location + "/") : "" ) + photoDefaultName);
                        if (location_info.host == "justone.co.kr") {
                            if (photo.location == "like" || photo.location == "relation" || photo.location == "collocation") {
                                var kr_good_id = photo.good_id;
                                photo_save_path = ((photo.location ? (photo.location + "/") : "" ) + kr_good_id + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1));
                            } else if (photo.location == "summary" && photo.type == "video") {
                                //photo_save_path = (photo.location ? (photo.location + "/") : "" ) + "video_info.txt";
                            }
                        }
                        photo_urls_str += (photo_save_path + "\t" +  photo.url + "\r\n");

                        // 替换html文件中图片地址为本地文件地址
                        if (photo.type != "video") {
                            pageDom.find('img[src="' + photo.url + '"]').attr("src", "./" + photo_save_path);
                        }
                        //pageHtml.replace(new RegExp(photo.url,"gm"), "./" + photo_save_path);
                    });
                    main_folder.file("photo_url_list.txt", photo_urls_str); // 图片链接列表
                    main_folder.file("page.html", pageDom.children(0)[0].outerHTML); // 保存本页面的html文件

                    if ($("#player_1").length > 0) {
                        main_folder.folder("summary").file("video.txt", $("#player_1").attr("src"));
                    }
                },
                "eachFileOnload_callback": function(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
                    if (location_info.host == "justone.co.kr" || location_info.host == "www.justone.co.kr") {
                        if (photo.location == "like" || photo.location == "relation" || photo.location == "collocation") {
                            var kr_good_id = photo.good_id;
                            photo.fileName = kr_good_id + "." + photo.url.substring(photo.url.lastIndexOf('.') + 1);
                            folder.file(kr_good_id + "_info.txt", "good_id：" + kr_good_id + "\r\n" + "good_url：" + photo.good_url);
                        } else if (photo.location == "summary" && photo.type == "video") {
                            //folder.file("video_" + zipFileLength + ".txt", photo.url);
                            return false;
                        }
                    }
                    return true;
                }
            }
        };
        if (options) {
            $.extend(true, config , options);
        }
        batchDownload(config);
    };

})(document, jQuery);
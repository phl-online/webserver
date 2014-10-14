﻿//  功能：搭建本地web服务，自动生成二维码，便于手机站测试
//  require:安装node.js(官网地址：http://www.nodejs.org/)
//  启动服务命令：
//  node start.js port(端口号可以省略，默认8080)
//  eg: node start.js 999
//  服务启动后，当前目录为根目录
//  Author:Liubei  E-mail:liubei528@gmail.com
var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

//配置
var config = {
    denyAccess: [],
    localIPs: ['127.0.0.1'],
    srcpath: '/src'
};
var os = require('os');
var IP = '';
var URL = '';

process.argv.forEach(function () {
  config.port = arguments[2][2] || 8080;
});


//开始HTTP服务器
http.createServer(processRequestRoute).listen(config.port);
function getLocalIP() {
    var map = [];
    var once = true;
    var ifaces = os.networkInterfaces();

    for (var dev in ifaces) {

        if( once && ifaces[dev][1] ){
            IP = ifaces[dev][1].address;
            once = false;
        }
        if (dev.indexOf('eth0') != -1) {
            var tokens = dev.split(':');
            var dev2 = null;
            if (tokens.length == 2) {
                dev2 = 'eth1:' + tokens[1];
            } else if (tokens.length == 1) {
                dev2 = 'eth1';
            }
            if (null == ifaces[dev2]) {
                continue;
            }
            IP = ifaces[dev];
            // 找到eth0和eth1分别的ip
            var ip = null, ip2 = null;
            ifaces[dev].forEach(function(details) {
                if (details.family == 'IPv4') {
                    ip = details.address;
                }
            });
            ifaces[dev2].forEach(function(details) {
                if (details.family == 'IPv4') {
                    ip2 = details.address;
                }
            });
            if (null == ip || null == ip2) {
                continue;
            }

            // 将记录添加到map中去
            if (ip.indexOf('10.') == 0 ||
                ip.indexOf('172.') == 0 ||
                ip.indexOf('192.') == 0) {
                map.push({"intranet_ip" : ip, "internet_ip" : ip2});
            } else {
                map.push({"intranet_ip" : ip2, "internet_ip" : ip});
            }
        }
    } 
    return map;
}
getLocalIP();
URL = "http://"+IP+":"+config.port;
console.log( "open http://"+IP+":"+config.port);

//路由URL
function processRequestRoute(request, response) {
    var pathname = url.parse(request.url).pathname;
    
    var ext = path.extname(pathname);
    var localPath = ''; //本地相对路径
    var staticres = false; //是否是静态资源
    if (ext.length > 0) {
        localPath = '.' + pathname;
        staticRes = true;
    } else {
        localPath = '.' + config.srcpath + pathname + '.js';
        staticRes = false;
    }
    //禁止远程访问
    if (config.denyAccess && config.denyAccess.length > 0) {
        var islocal = false;
        var remoteAddress = request.connection.remoteAddress;
        for (var j = 0; j < config.localIPs.length; j++) {
            if (remoteAddress === config.localIPs[j]) {
                islocal = true;
                break;
            }
        }
        if (!islocal) {
            for (var i = 0; i < config.denyAccess.length; i++) {
                if (localPath === config.denyAccess[i]) {
                    response.writeHead(403, { 'Content-Type': 'text/plain' });
                    response.end('403:Deny access to this page');
                    return;
                }
            }
        }
    }
    //禁止访问后端js
    if (staticRes && localPath.indexOf(config.srcpath) >= 0) {
        response.writeHead(403, { 'Content-Type': 'text/plain' });
        response.end('403:Deny access to this page');
        return;
    }

    fs.exists(localPath, function (exists) {
        if (exists) {
            if (staticRes) {
                staticResHandler(localPath, ext, response); //静态资源
            } else {
                try {
                    var handler = require(localPath);
                    if (handler.processRequest && typeof handler.processRequest === 'function') {
                        handler.processRequest(request, response); //动态资源
                    } else {
                        response.writeHead(404, { 'Content-Type': 'text/plain' });
                        response.end('404:Handle Not found');
                    }
                } catch (exception) {
                    console.log('error::url:' + request.url + 'msg:' + exception);
                    response.writeHead(500, { "Content-Type": "text/plain" });
                    response.end("Server Error:" + exception);
                }
            }
        } else { //资源不存在
            response.writeHead(404, { 'Content-Type': 'text/plain' });
            if (pathname === '/') {
                response.writeHead(200, { "Content-Type": "text/html" });
                response.end("<html><meta charset='utf-8'><title>扫描二维码</title></html><div style='text-align:center;margin-top:100px;'><p><a target='_blank' href='"+URL+"/index.html'>"+URL+"/index.html</a></p><p><img src='http://trans.2sitebbs.com/qr/?w=100&h=100&str="+URL+"/index.html'/></p></div></html>");
            }
        }
    });
}

//处理静态资源
function staticResHandler(localPath, ext, response) {
    fs.readFile(localPath, "binary", function (error, file) {
        if (error) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.end("Server Error:" + error);
        } else {
            response.writeHead(200, { "Content-Type": getContentTypeByExt(ext) });
            response.end(file, "binary");
        }
    });
}

//得到ContentType
function getContentTypeByExt(ext) {
    ext = ext.toLowerCase();
    if (ext === '.htm' || ext === '.html')
        return 'text/html';
    else if (ext === '.js')
        return 'application/x-javascript';
    else if (ext === '.css')
        return 'text/css';
    else if (ext === '.jpe' || ext === '.jpeg' || ext === '.jpg')
        return 'image/jpeg';
    else if (ext === '.png')
        return 'image/png';
    else if (ext === '.ico')
        return 'image/x-icon';
    else if (ext === '.zip')
        return 'application/zip';
    else if (ext === '.doc')
        return 'application/msword';
    else
        return 'text/plain';
}
// ==UserScript==
// @name         Google Play 控制台报表下载
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  监听并解析 Play Console ANR/崩溃 数据，仅导出每日百分比
// @author       You
// @match        https://play.google.com/console/u/*/developers/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    let aggregatedData = [];
    let reportDates = [];  // Now reportDate is an array

    // 导出 XLSX 文件，横向插入数据
    function downloadXLSX(data, dates) {
        // 构造数据
        const ws_data = [
            ['日期', ...data.map((item, index) => dates[index])],  // 表头，横向排列
            ['百分比', ...data.map(item => item.percentage)]  // 数据行，横向排列
        ];

        // 使用 SheetJS 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ANR Data');

        // 设置列宽（根据内容适当设置列宽）
        ws['!cols'] = [
            { wch: 15 },  // 日期列宽
            ...data.map(() => ({ wch: 15 }))  // 为每个百分比列设置宽度
        ];

        // 获取当前时间戳并生成文件名
        const filename = `play_console_data_${new Date().toISOString().replace(/[:.]/g, "_")}.xlsx`;

        // 导出为 .xlsx 文件
        XLSX.writeFile(wb, filename);
    }

    // 创建下载按钮
    function createDownloadButton() {
        // 只有在有数据时才创建下载按钮
        if (aggregatedData.length > 0) {
            const button = document.createElement("button");
            button.innerText = "下载数据";
            button.style.position = "fixed";
            button.style.top = "100px";
            button.style.right = "20px";
            button.style.padding = "12px 20px"; // 增加内边距
            button.style.background = "#ff3563";
            button.style.color = "white";
            button.style.border = "none";
            button.style.cursor = "pointer";
            button.style.borderRadius = "30px"; // 圆角
            button.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)"; // 阴影效果
            button.style.fontSize = "16px";
            button.style.transition = "all 0.3s ease"; // 平滑过渡

            // 按钮悬停时的样式
            button.onmouseover = () => {
                button.style.backgroundColor = "#e02e57"; // 背景色变化
                button.style.transform = "scale(1.05)"; // 稍微放大
            };
            button.onmouseout = () => {
                button.style.backgroundColor = "#ff3563"; // 恢复背景色
                button.style.transform = "scale(1)"; // 恢复正常大小
            };

            button.onclick = () => {
                downloadXLSX(aggregatedData, reportDates);
                setTimeout(() => {
                    button.style.display = "none";
                }, 3000);
            };

            document.body.appendChild(button);
        }
    }

    // 拦截 XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (url.includes("USER_PERCEIVED_ANRS:details") || url.includes("USER_PERCEIVED_CRASHES:details")) {
            console.log("拦截到 XMLHttpRequest 请求:", url);
            this.addEventListener("load", function() {
                try {
                    const response = this.responseText;
                    const data = JSON.parse(response);
                    if (data["4"] && data["4"]["1"]) {
                        aggregatedData = [];
                        reportDates = [];  // Reset the reportDates array on each request
                        data["4"]["1"].forEach(item => {
                            if (item["2"] && item["2"]["2"]) {
                                let percentage = (item["2"]["2"] * 100).toFixed(2) + '%';
                                aggregatedData.push({ percentage });
                            }
                            if (item["4"] && item["4"]["1"] && item["4"]["2"] && item["4"]["3"]) {
                                // 确保月份和日期始终为两位数
                                let year = item["4"]["1"];
                                let month = String(item["4"]["2"]).padStart(2, '0');
                                let day = String(item["4"]["3"]).padStart(2, '0');
                                let date = `${year}-${month}-${day}`;
                                reportDates.push(date);  // Push each date into the reportDates array
                            }
                        });
                        console.log("汇总数据:", aggregatedData);
                        console.log("报告日期:", reportDates);

                        createDownloadButton();
                    }
                } catch (e) {
                    console.error("解析返回数据失败", e);
                }
            });
        }
        return originalOpen.apply(this, arguments);
    };
})();

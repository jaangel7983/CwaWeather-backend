require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// CWA API 設定
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * 取得指定縣市天氣預報 (通用版)
 */
const getWeatherByCity = async (req, res) => {
  let { city } = req.params;

  // 容錯處理：自動將 '台' 轉為 '臺' (解決 CWA API 嚴格檢查問題)
  if (city) {
    city = city.replace(/台/g, "臺");
  }

  try {
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: city,
        },
      }
    );
    
    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        success: false,
        message: `查無 '${req.params.city}' 資料，請確認縣市名稱是否正確。`,
      });
    }

    // 整理資料結構
    const weatherData = {
      city: locationData.locationName,
      updateTime: response.data.records.datasetDescription,
      forecasts: [],
    };

    const weatherElements = locationData.weatherElement;
    const timeCount = weatherElements[0].time.length;

    for (let i = 0; i < timeCount; i++) {
      const forecast = {
        startTime: weatherElements[0].time[i].startTime,
        endTime: weatherElements[0].time[i].endTime,
        weather: "",
        rain: "",
        minTemp: "",
        maxTemp: "",
        comfort: "",
        windSpeed: "",
      };

      weatherElements.forEach((element) => {
        const value = element.time[i].parameter;
        switch (element.elementName) {
          case "Wx":   forecast.weather = value.parameterName; break;
          case "PoP":  forecast.rain = value.parameterName + "%"; break;
          case "MinT": forecast.minTemp = value.parameterName + "°C"; break;
          case "MaxT": forecast.maxTemp = value.parameterName + "°C"; break;
          case "CI":   forecast.comfort = value.parameterName; break;
          case "WS":   forecast.windSpeed = value.parameterName; break;
        }
      });

      weatherData.forecasts.push(forecast);
    }

    res.json({
      success: true,
      data: weatherData,
    });

  } catch (error) {
    console.error(`Get Weather Error (${city}):`, error.message);
    
    // 若 Axios 有回傳詳細錯誤 (如 Key 錯誤)
    if (error.response) {
        return res.status(error.response.status).json({ error: error.response.data });
    }
    
    res.status(500).json({ error: error.message });
  }
};

// --- Routes 定義區 ---

// 健康檢查
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 天氣查詢 (動態路由)
app.get("/api/weather/:city", getWeatherByCity);

// API 說明頁
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用 CWA 天氣預報 API",
    usage: "GET /api/weather/{縣市名稱}",
    endpoints: {
      // 北部
      keelung_y: "/api/weather/基隆市",
      taipei_y: "/api/weather/臺北市",
      new_taipei_y: "/api/weather/新北市",
      taoyuan_y: "/api/weather/桃園市",
      hsinchu_y: "/api/weather/新竹市",
      hsinchu_x: "/api/weather/新竹縣",
      yilan_x: "/api/weather/宜蘭縣",

      // 中部
      miaoli_x: "/api/weather/苗栗縣",
      taichung_y: "/api/weather/臺中市",
      changhua_x: "/api/weather/彰化縣",
      nantou_x: "/api/weather/南投縣",
      yunlin_x: "/api/weather/雲林縣",

      // 南部
      chiayi_y: "/api/weather/嘉義市",
      chiayi_x: "/api/weather/嘉義縣",
      tainan_y: "/api/weather/臺南市",
      kaohsiung_y: "/api/weather/高雄市",
      pingtung_x: "/api/weather/屏東縣",

      // 東部
      hualien_x: "/api/weather/花蓮縣",
      taitung_x: "/api/weather/臺東縣",

      // 離島
      penghu_x: "/api/weather/澎湖縣",
      kinmen_x: "/api/weather/金門縣",
      lienchiang_x: "/api/weather/連江縣", // 馬祖
    },
    health: "/api/health",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "找不到此路徑" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "伺服器內部錯誤",
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
});
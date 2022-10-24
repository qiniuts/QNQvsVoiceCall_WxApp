// index.js
// 获取应用实例
const app = getApp()
import { delay } from "../../utils/util"
const alawmulaw = require('alawmulaw');
Page({
  data: {
    motto: 'Hello World',
    button: "开始录音",
    talkUrl: "",
    record_status: undefined,
  },
  clickme: function () {
    let status = this.data.record_status;
    if (this.data.button == "开始录音") {
      this.startRecord();
      this.setData({
        record_status: undefined, 
      })
    }
    if (this.data.button == "停止录音") {
      this.stopRecord();
    }
  },
  stopRecord: function () {
    this.manager.stop();
    this.setData({
      record_status: "manstop", // 手动停止；因为开始录音后，60s左右会自动停止，代码里设置了自动重新拉起录音，这里是在强行手动停止；
    })
  },
  startRecord() {
    this.manager.start({ // 设置frameSize后，录音的pcm数据每达到10KB，就会触发onFrameRecorded回调，但在60s后会自动停止，因此需要重新start
      format: "PCM",
      frameSize: 10,
      numberOfChannels: 1,
    })
  },
  getTalkUrl() {
    let that = this;
    // 获取发送音频的链接，该服务在自己服务端配置
    // 参考 https://developer.qiniu.com/qvs/10744/one-to-many-voice-intercom#5
    // 拿到对应的http或者https链接用来发送音频数据
    // 
    wx.request({
      method:"GET",
      url: '请填入获取发送音频的url',
      success(res) {
        if (res.statusCode == 200) {
          console.log(res.data)
          let url = res.data.audioSendAddrForHttps;
          console.log(url);
          wx.showToast({
            title: '获取地址成功',
            icon: 'success',
            duration: 1000
          })
          that.setData({
            talkUrl: url,
          })
        }
        else {
          console.error("获取地址失败", res.statusCode, res.data)
        }
      },
      fail(res) {
        console.error("获取地址失败", res.statusCode, res.data);
        wx.showToast({
          title: '获取地址失败',
        })
      }
    })
  },
  onLoad: function () {
    this.manager = wx.getRecorderManager();
    this.manager.onStart(() => {
      console.log("开始录音");
      this.setData({
        button: "停止录音"
      })
    })
    this.manager.onStop(async (res) => {
      console.log(res.duration, res.fileSize, res.tempFilePath);
      let name = res.tempFilePath.split(/\/\//g)[1]; // 文件名
      let filePath = res.tempFilePath;
      // 最终将生成的pcm文件上传保存，可选操作
      // 表单上传：https://developer.qiniu.com/kodo/1272/form-upload
      // 上传token：https://developer.qiniu.com/kodo/1208/upload-token
      // 
      wx.request({
        url: `请填入获取上传文件token的url`,
        success(res) {
          let token = res.data;
          console.log("token", token);
          wx.uploadFile({
            filePath: filePath,
            name: 'file',
            url: 'https://upload.qiniup.com', // 上传到华东，其他区域参考：https://developer.qiniu.com/kodo/1671/region-endpoint-fq
            formData: {
              token: token,
              key: name
            },
            success(res) {
              console.log("上传成功", res);
            },
            fail(res) {
              console.log("上传失败", res);
            }
          })
        }
      })
      if (this.data.record_status == "manstop") {
        this.setData({
          button: "开始录音"
        })
      } else {
        this.startRecord();
      }

    }),
      this.manager.onError((res) => {
        console.error("record error", res)
      }),
      this.manager.onFrameRecorded((res) => {
        console.warn(res.frameBuffer, res.isLastFrame);
        // 转码关键
        // https://developer.qiniu.com/qvs/10744/one-to-many-voice-intercom
        let g711 = alawmulaw.alaw.encode(new Int16Array(res.frameBuffer));
        let b64buffer = wx.arrayBufferToBase64(g711.buffer.slice(g711.buffer, g711.byteLength, g711.byteOffset));
        wx.request({
          url: this.data.talkUrl,
          header: {
            "content-type": "application/json"
          },
          data: {
            base64_pcm: b64buffer,
          },
          method: "POST",
          success(res) {
            if (res.data.code == 0) {
              console.log("发送音频成功", res.data.code);
            }
            else {
              console.log("发送音频失败", res.data.code);
            }

          },
          fail(res) {
            console.error("发送音频失败", res.data);
          }
        })
      })
  },
  onReady: function () {
    this.setData({
      button: "开始录音"
    })
  },
  onShow: function () {
    wx.setKeepScreenOn({
      keepScreenOn: true,
    })
  }
})

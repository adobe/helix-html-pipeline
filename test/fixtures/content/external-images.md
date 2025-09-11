# External Images Test

External image with width and height parameters:

![External Image](https://example.com/adobe/assets/image.jpg?width=800&height=600&other=param)

External image with only width parameter:

![External Image 2](https://example.com/adobe/assets/image2.jpg?width=1200&other=param)

External image without width/height parameters (should NOT be processed):

![External Image 3](https://example.com/adobe/assets/image3.jpg)

Regular media bus image (should NOT be processed as external image, but converted to picture):

![Media Image](https://main--pages--adobe.hlx.live/media_abc123.jpg#width=800&height=600)

Other external image (should be processed as external image):

![Other Image](https://other-domain.com/image.jpg?width=400&height=300)

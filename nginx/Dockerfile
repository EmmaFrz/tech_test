FROM nginx:1.30.6-alpine3.24
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

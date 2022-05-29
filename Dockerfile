FROM fedora-minimal:latest
MAINTAINER "Exios Consulting"
LABEL version="1.0.3"

RUN microdnf -y --nodocs install git nodejs && \
    microdnf clean all && \
    echo 'export PATH=$PATH:/home/rest/rest-api-demo/' >> /root/.bashrc && \
    mkdir /home/rest

WORKDIR /home/rest
RUN git clone https://github.com/kbaniak/rest-api-demo && \
    cd /home/rest/rest-api-demo && \
    npm install

WORKDIR /home/rest/rest-api-demo
CMD [ "node svc.mjs -p" ]
EXPOSE 20070/tcp
EXPOSE 20071/tcp

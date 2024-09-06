# (c) 2022 Copyright, Real-Time Innovations, Inc.  All rights reserved.
# No duplications, whole or partial, manual or electronic, may be made
# without express written permission.  Any such copies, or revisions thereof,
# must display this notice unaltered.
# This code contains trade secrets of Real-Time Innovations, Inc.
FROM quay.io/pypa/manylinux2010_x86_64
ARG USER_NAME=jenkins
ARG USER_UID

RUN adduser $USER_NAME -u $USER_UID
RUN yum install -y graphviz
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
RUN /opt/python/cp36-cp36m/bin/pip install poetry==1.1.14 poetry-dynamic-versioning

ENV PATH=/home/jenkins/.local/bin:/opt/python/cp36-cp36m/bin:$PATH
ENV PATH=/opt/python/cp37-cp37m/bin:$PATH
ENV PATH=/opt/python/cp38-cp38m/bin:$PATH
ENV PATH=/opt/python/cp39-cp39m/bin:$PATH
ENV PATH=/opt/python/cp310-cp310m/bin:$PATH

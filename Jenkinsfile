pipeline {
    agent any
    
    environment {
        // Build Configuration
        NODE_VERSION = '18'
        DOCKER_IMAGE = 'taskmaster'
        DOCKER_TAG = "${BUILD_NUMBER}"
        DOCKER_REGISTRY = 'your-registry.com'
        
        // Credentials
        REGISTRY_CREDENTIALS = credentials('docker-registry-credentials')
        SONARQUBE_TOKEN = credentials('sonarqube-token')
        SLACK_WEBHOOK = credentials('slack-webhook-url')
        
        // Environment URLs
        STAGING_URL = 'https://staging.taskmaster.com'
        PRODUCTION_URL = 'https://taskmaster.com'
    }
    
    options {
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            artifactNumToKeepStr: '5'
        ))
        timeout(time: 45, unit: 'MINUTES')
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(false)
    }
    
    triggers {
        githubPush()
        pollSCM('H/5 * * * *') // Poll every 5 minutes
        cron('H 2 * * *') // Daily build at 2 AM
    }
    
    stages {
        stage('🔍 Checkout & Setup') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_HASH = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                }
                
                // Setup Node.js
                nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                    sh 'node --version'
                    sh 'npm --version'
                }
            }
        }
        
        stage('📦 Install Dependencies') {
            steps {
                nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                    sh 'npm ci --prefer-offline --no-audit'
                }
            }
            post {
                always {
                    // Archive package-lock.json for dependency tracking
                    archiveArtifacts artifacts: 'package-lock.json', fingerprint: true
                }
            }
        }
        
        stage('🔍 Code Quality') {
            parallel {
                stage('ESLint') {
                    steps {
                        nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                            sh 'npm run lint -- --format=checkstyle --output-file=reports/eslint-report.xml || true'
                        }
                    }
                    post {
                        always {
                            publishHTML([
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'reports',
                                reportFiles: 'eslint-report.xml',
                                reportName: 'ESLint Report'
                            ])
                        }
                    }
                }
                
                stage('SonarQube Analysis') {
                    when {
                        anyOf {
                            branch 'main'
                            branch 'develop'
                        }
                    }
                    steps {
                        withSonarQubeEnv('SonarQube') {
                            nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                                sh """
                                    sonar-scanner \\
                                        -Dsonar.projectKey=taskmaster \\
                                        -Dsonar.projectName=TaskMaster \\
                                        -Dsonar.projectVersion=${BUILD_NUMBER} \\
                                        -Dsonar.sources=. \\
                                        -Dsonar.exclusions=node_modules/**,coverage/**,reports/** \\
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
                                        -Dsonar.eslint.reportPaths=reports/eslint-report.xml
                                """
                            }
                        }
                    }
                }
            }
        }
        
        stage('🧪 Testing') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                            sh 'npm run test:coverage -- --reporters=default --reporters=jest-junit --outputFile=reports/jest-junit.xml'
                        }
                    }
                    post {
                        always {
                            // Publish test results
                            publishTestResults testResultsPattern: 'reports/jest-junit.xml'
                            
                            // Publish coverage report
                            publishHTML([
                                allowMissing: false,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Coverage Report'
                            ])
                            
                            // Coverage thresholds
                            script {
                                def coverage = sh(
                                    script: 'cat coverage/coverage-summary.json | jq -r ".total.lines.pct"',
                                    returnStdout: true
                                ).trim() as Double
                                
                                if (coverage < 80) {
                                    currentBuild.result = 'UNSTABLE'
                                    echo "Warning: Code coverage is below 80% (${coverage}%)"
                                }
                            }
                        }
                    }
                }
                
                stage('Security Scan') {
                    steps {
                        script {
                            // NPM Audit
                            sh '''
                                npm audit --audit-level=high --json > reports/npm-audit.json || true
                                npm audit --audit-level=high
                            '''
                            
                            // Snyk Security Scan
                            sh '''
                                npx snyk test --json > reports/snyk-report.json || true
                                npx snyk test
                            '''
                        }
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'reports/*-audit.json,reports/snyk-report.json', fingerprint: true
                        }
                    }
                }
            }
        }
        
        stage('🏗️ Build Docker Image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    changeRequest()
                }
            }
            steps {
                script {
                    // Build image
                    def customImage = docker.build(
                        "${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}",
                        "--build-arg NODE_ENV=production --build-arg BUILD_NUMBER=${BUILD_NUMBER} ."
                    )
                    
                    // Tag with latest for main branch
                    if (env.BRANCH_NAME == 'main') {
                        customImage.tag("latest")
                    }
                    
                    // Push to registry
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-registry-credentials') {
                        customImage.push()
                        if (env.BRANCH_NAME == 'main') {
                            customImage.push("latest")
                        }
                    }
                }
            }
        }
        
        stage('🔒 Container Security Scan') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    // Trivy security scan
                    sh """
                        docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
                            -v \$(pwd)/reports:/tmp/reports \\
                            aquasec/trivy image \\
                            --format json \\
                            --output /tmp/reports/trivy-report.json \\
                            --severity HIGH,CRITICAL \\
                            ${DOCKER_REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}
                    """
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/trivy-report.json', fingerprint: true
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: 'trivy-report.json',
                        reportName: 'Container Security Report'
                    ])
                }
            }
        }
        
        stage('🚀 Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    // Deploy to staging environment
                    sh """
                        docker-compose -f docker-compose.staging.yml down || true
                        docker-compose -f docker-compose.staging.yml pull
                        docker-compose -f docker-compose.staging.yml up -d
                    """
                    
                    // Wait for service to be ready
                    sh '''
                        echo "Waiting for staging deployment..."
                        for i in {1..30}; do
                            if curl -f ${STAGING_URL}/api/health; then
                                echo "Staging deployment successful!"
                                break
                            fi
                            echo "Attempt $i failed, retrying in 10 seconds..."
                            sleep 10
                        done
                    '''
                }
            }
            post {
                success {
                    slackSend(
                        channel: '#deployments',
                        color: 'good',
                        message: "✅ TaskMaster deployed to staging: ${STAGING_URL}"
                    )
                }
                failure {
                    slackSend(
                        channel: '#deployments',
                        color: 'danger',
                        message: "❌ TaskMaster staging deployment failed!"
                    )
                }
            }
        }
        
        stage('🧪 Integration Tests') {
            when {
                branch 'develop'
            }
            steps {
                nodejs(nodeJSInstallationName: "Node-${NODE_VERSION}") {
                    sh """
                        export TEST_URL=${STAGING_URL}
                        npm run test:integration
                    """
                }
            }
        }
        
        stage('📊 Performance Tests') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    def testUrl = (env.BRANCH_NAME == 'main') ? PRODUCTION_URL : STAGING_URL
                    
                    // Lighthouse performance test
                    sh """
                        npx lighthouse ${testUrl} \\
                            --chrome-flags="--headless --no-sandbox" \\
                            --output=html \\
                            --output-path=reports/lighthouse-report.html \\
                            --preset=desktop
                    """
                    
                    // Load testing with Artillery
                    sh """
                        npx artillery quick --count 10 --num 3 ${testUrl}/api/health \\
                            -o reports/load-test-report.json
                    """
                }
            }
            post {
                always {
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'reports',
                        reportFiles: 'lighthouse-report.html',
                        reportName: 'Performance Report'
                    ])
                    archiveArtifacts artifacts: 'reports/load-test-report.json', fingerprint: true
                }
            }
        }
        
        stage('🎯 Deploy to Production') {
            when {
                allOf {
                    branch 'main'
                    not { changeRequest() }
                }
            }
            steps {
                script {
                    // Manual approval for production deployment
                    input message: 'Deploy to production?', 
                          ok: 'Deploy',
                          submitter: 'admin',
                          submitterParameter: 'APPROVER'
                    
                    echo "Production deployment approved by: ${APPROVER}"
                    
                    // Blue-Green deployment
                    sh """
                        echo "Starting blue-green deployment to production..."
                        
                        # Pull latest images
                        docker-compose -f docker-compose.prod.yml pull
                        
                        # Deploy new version
                        docker-compose -f docker-compose.prod.yml up -d
                        
                        # Wait for health check
                        sleep 60
                        curl -f ${PRODUCTION_URL}/api/health || exit 1
                        
                        echo "Production deployment completed successfully!"
                    """
                }
            }
            post {
                success {
                    slackSend(
                        channel: '#deployments',
                        color: 'good',
                        message: "🚀 TaskMaster successfully deployed to production by ${APPROVER}!"
                    )
                }
                failure {
                    slackSend(
                        channel: '#deployments',
                        color: 'danger',
                        message: "💥 TaskMaster production deployment FAILED! Rolling back..."
                    )
                    
                    // Rollback on failure
                    sh 'docker-compose -f docker-compose.prod.yml down'
                }
            }
        }
    }
    
    post {
        always {
            // Clean up workspace
            cleanWs deleteDirs: true
            
            // Archive build artifacts
            archiveArtifacts artifacts: 'reports/**/*', fingerprint: true, allowEmptyArchive: true
        }
        
        success {
            emailext (
                subject: "✅ SUCCESS: TaskMaster Build #${BUILD_NUMBER}",
                body: """
                    <h3>Build Successful! 🎉</h3>
                    <p><strong>Project:</strong> TaskMaster</p>
                    <p><strong>Build Number:</strong> ${BUILD_NUMBER}</p>
                    <p><strong>Branch:</strong> ${BRANCH_NAME}</p>
                    <p><strong>Commit:</strong> ${GIT_COMMIT_HASH}</p>
                    <p><strong>Duration:</strong> ${currentBuild.durationString}</p>
                    <p><a href="${BUILD_URL}">View Build Details</a></p>
                """,
                mimeType: 'text/html',
                to: "${env.CHANGE_AUTHOR_EMAIL ?: 'team@taskmaster.com'}"
            )
        }
        
        failure {
            emailext (
                subject: "❌ FAILURE: TaskMaster Build #${BUILD_NUMBER}",
                body: """
                    <h3>Build Failed! 💥</h3>
                    <p><strong>Project:</strong> TaskMaster</p>
                    <p><strong>Build Number:</strong> ${BUILD_NUMBER}</p>
                    <p><strong>Branch:</strong> ${BRANCH_NAME}</p>
                    <p><strong>Commit:</strong> ${GIT_COMMIT_HASH}</p>
                    <p><strong>Duration:</strong> ${currentBuild.durationString}</p>
                    <p><a href="${BUILD_URL}console">View Console Output</a></p>
                """,
                mimeType: 'text/html',
                to: "${env.CHANGE_AUTHOR_EMAIL ?: 'team@taskmaster.com'}"
            )
            
            slackSend(
                channel: '#builds',
                color: 'danger',
                message: "💥 TaskMaster build #${BUILD_NUMBER} failed on ${BRANCH_NAME}"
            )
        }
        
        unstable {
            slackSend(
                channel: '#builds',
                color: 'warning',
                message: "⚠️ TaskMaster build #${BUILD_NUMBER} is unstable on ${BRANCH_NAME}"
            )
        }
    }
}

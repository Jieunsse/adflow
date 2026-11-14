package ai.adflow.api.client;

import ai.adflow.api.store.OwnerScoped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** 고객사 — 영업 단계와 계약 (기능 14, 정책서 27절). 청구는 ClientBill 에 따로 둔다(팀장만 본다). */
@Entity
@Table(name = "clients")
public class Client extends OwnerScoped {

  public static final String INQUIRY = "inquiry";
  public static final String CONSULT = "consult";
  public static final String PROPOSAL = "proposal";
  public static final String CONTRACT = "contract";
  public static final String RENEWAL = "renewal";
  public static final String ENDED = "ended";

  @Column(nullable = false)
  private String name;

  private String contact;
  private String industry;

  /** experiment_post · meta_ad · referral · other */
  @Column(name = "inquiry_source")
  private String inquirySource;

  @Column(nullable = false)
  private String stage;

  @Column(name = "manager_email")
  private String managerEmail;

  @Column(name = "next_action", length = 300)
  private String nextAction;

  @Column(name = "next_action_date")
  private String nextActionDate;

  @Column(name = "case_study_consent")
  private Boolean caseStudyConsent;

  /** 받지 않는 업종(정책서 23.2)으로 표시. 표시하면 상담으로 넘길 수 없다. */
  @Column(name = "excluded_industry")
  private Boolean excludedIndustry;

  /** light · standard */
  private String product;

  /** prepaid · postpaid */
  @Column(name = "billing_type")
  private String billingType;

  @Column(name = "monthly_price")
  private Long monthlyPrice;

  @Column(name = "contract_start")
  private String contractStart;

  @Column(name = "contract_end")
  private String contractEnd;

  @Column(name = "cancel_notice_date")
  private String cancelNoticeDate;

  @Column(name = "cancel_date")
  private String cancelDate;

  /** 계약으로 바꿀 때 만든 브랜드(브랜드 프로필 id). */
  @Column(name = "brand_profile_id")
  private String brandProfileId;

  @Column(name = "created_at", nullable = false)
  private String createdAt;

  public String getName() { return name; }
  public void setName(String v) { this.name = v; }
  public String getContact() { return contact; }
  public void setContact(String v) { this.contact = v; }
  public String getIndustry() { return industry; }
  public void setIndustry(String v) { this.industry = v; }
  public String getInquirySource() { return inquirySource; }
  public void setInquirySource(String v) { this.inquirySource = v; }
  public String getStage() { return stage; }
  public void setStage(String v) { this.stage = v; }
  public String getManagerEmail() { return managerEmail; }
  public void setManagerEmail(String v) { this.managerEmail = v; }
  public String getNextAction() { return nextAction; }
  public void setNextAction(String v) { this.nextAction = v; }
  public String getNextActionDate() { return nextActionDate; }
  public void setNextActionDate(String v) { this.nextActionDate = v; }
  public Boolean getCaseStudyConsent() { return caseStudyConsent; }
  public void setCaseStudyConsent(Boolean v) { this.caseStudyConsent = v; }
  public Boolean getExcludedIndustry() { return excludedIndustry; }
  public void setExcludedIndustry(Boolean v) { this.excludedIndustry = v; }
  public String getProduct() { return product; }
  public void setProduct(String v) { this.product = v; }
  public String getBillingType() { return billingType; }
  public void setBillingType(String v) { this.billingType = v; }
  public Long getMonthlyPrice() { return monthlyPrice; }
  public void setMonthlyPrice(Long v) { this.monthlyPrice = v; }
  public String getContractStart() { return contractStart; }
  public void setContractStart(String v) { this.contractStart = v; }
  public String getContractEnd() { return contractEnd; }
  public void setContractEnd(String v) { this.contractEnd = v; }
  public String getCancelNoticeDate() { return cancelNoticeDate; }
  public void setCancelNoticeDate(String v) { this.cancelNoticeDate = v; }
  public String getCancelDate() { return cancelDate; }
  public void setCancelDate(String v) { this.cancelDate = v; }
  public String getBrandProfileId() { return brandProfileId; }
  public void setBrandProfileId(String v) { this.brandProfileId = v; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String v) { this.createdAt = v; }
}

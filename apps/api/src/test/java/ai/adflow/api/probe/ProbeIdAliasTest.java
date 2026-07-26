package ai.adflow.api.probe;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.store.OwnerScoped;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@ActiveProfiles("test")
class ProbeIdAliasTest {

  /** 와이어 이름은 campaignId, 저장은 OwnerScoped.id 를 그대로 쓴다. */
  @Entity
  @Table(name = "probe_alias")
  @JsonIgnoreProperties("id")
  public static class ProbeLaunch extends OwnerScoped {

    private Integer dailyBudget;

    @JsonProperty("campaignId")
    public String getCampaignId() {
      return getId();
    }

    @JsonProperty("campaignId")
    public void setCampaignId(String v) {
      setId(v);
    }

    public Integer getDailyBudget() { return dailyBudget; }
    public void setDailyBudget(Integer v) { this.dailyBudget = v; }
  }

  @Autowired private ObjectMapper mapper;

  @Test
  void 와이어는_campaignId_저장은_id() throws Exception {
    ProbeLaunch in = mapper.readValue("{\"campaignId\":\"c_1\",\"dailyBudget\":5000}", ProbeLaunch.class);
    assertThat(in.getId()).isEqualTo("c_1");

    String out = mapper.writeValueAsString(in);
    System.out.println("PROBE-ALIAS: " + out);
    assertThat(out).contains("\"campaignId\":\"c_1\"");
    assertThat(out).doesNotContain("\"id\"");
    assertThat(out).doesNotContain("ownerKey");
  }
}
